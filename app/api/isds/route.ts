import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { callIsds, createRequest, downloadRequest, findRequest, isFault, isOk, listRequest, parseCreated, parseDownload, parseFind, parseList, statusOf, type Credentials, type IsdsEnv } from '@/lib/isds';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const MAX_SEND_BYTES = 10 * 1024 * 1024;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const NO_STORE = { 'Cache-Control': 'no-store' };

// Most k datovým schránkám. Přihlašovací údaje přicházejí zašifrované jen transportem (HTTPS) a použijí se na jedno volání;
// server je neukládá ani nezapisuje do logů. Pracuje se schránkou přihlášeného advokáta, nikdy se nic neukládá do databáze.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error: ue } = await user.auth.getUser(token);
    if (ue || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (rateLimited(`isds:${u.user.id}`, 30, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const env: IsdsEnv = body.env === 'prod' ? 'prod' : 'test';
    const cred: Credentials = { login: clean(body.login, 80), password: typeof body.password === 'string' ? body.password.slice(0, 200) : '' };
    const action = body.action;
    if (action !== 'find' && (!cred.login || !cred.password)) return NextResponse.json({ error: 'bad_request', message: 'Chybí přihlašovací údaje.' }, { status: 400 });

    const fail = (r: { kind: string }) => r.kind === 'auth'
        ? NextResponse.json({ error: 'isds_auth', message: 'Datová schránka odmítla přihlášení. Zkontrolujte jméno a heslo (a zda má účet povolený přístup přes aplikace).' }, { status: 401, headers: NO_STORE })
        : NextResponse.json({ error: 'upstream', message: 'Datové schránky teď neodpovídají.' }, { status: 502, headers: NO_STORE });

    if (action === 'list') {
        const received = body.received !== false;
        const base = { received, from: clean(body.from, 30) || undefined, to: clean(body.to, 30) || undefined, offset: 1, limit: 50 };
        let r = await callIsds(env, 'dx', listRequest(base), cred);
        // Oficiální dokumentace u přijatých zpráv používá i překlep „Recieved“; když první pokus selže, zkusí se druhý zápis
        if (r.ok && received && isFault(r.xml)) r = await callIsds(env, 'dx', listRequest(base, 'Recieved'), cred);
        if (!r.ok) return fail(r);
        const st = statusOf(r.xml);
        if (isFault(r.xml) || (st.code && !isOk(st) && st.code !== '1004')) return NextResponse.json({ error: 'isds', message: st.message || 'Datová schránka vrátila chybu.', code: st.code }, { status: 502, headers: NO_STORE });
        return NextResponse.json({ records: parseList(r.xml) }, { headers: NO_STORE });
    }

    if (action === 'download') {
        const id = clean(body.id, 20);
        if (!/^\d{1,20}$/.test(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
        // Stažení neodeslaných zpráv je doručí; kdo to nechce, musí potvrdit v rozhraní (confirmDelivery)
        if (body.confirmDelivery !== true && body.undelivered === true) return NextResponse.json({ error: 'confirm', message: 'Stažení zprávy ji doručí. Potvrďte to.' }, { status: 409 });
        const r = await callIsds(env, 'dz', downloadRequest(id), cred);
        if (!r.ok) return fail(r);
        const st = statusOf(r.xml);
        const msg = parseDownload(r.xml);
        if (!msg || (st.code && !isOk(st))) return NextResponse.json({ error: 'isds', message: st.message || 'Zprávu se nepodařilo stáhnout.', code: st.code }, { status: 502, headers: NO_STORE });
        return NextResponse.json({ message: msg }, { headers: NO_STORE });
    }

    if (action === 'find') {
        const ic = clean(body.ic, 12).replace(/\s+/g, '');
        const name = clean(body.name, 100);
        if (!/^\d{8}$/.test(ic) && name.length < 3) return NextResponse.json({ results: [] });
        const r = await callIsds(env, 'df', findRequest(ic && /^\d{8}$/.test(ic) ? { ic } : { name }), cred);
        if (!r.ok) return fail(r);
        return NextResponse.json({ results: parseFind(r.xml).slice(0, 15) }, { headers: NO_STORE });
    }

    if (action === 'send') {
        const recipient = clean(body.recipient, 10);
        const annotation = clean(body.annotation, 255);
        const files = Array.isArray(body.files) ? body.files : [];
        if (!/^[a-z0-9]{7}$/.test(recipient) || !annotation || files.length < 1 || files.length > 20) return NextResponse.json({ error: 'bad_request', message: 'Vyplňte příjemce (ID schránky), věc a aspoň jednu přílohu.' }, { status: 400 });
        let total = 0;
        const out = [];
        for (const f of files as Record<string, unknown>[]) {
            const b64 = typeof f.base64 === 'string' ? f.base64.replace(/\s+/g, '') : '';
            if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return NextResponse.json({ error: 'bad_request', message: 'Neplatná příloha.' }, { status: 400 });
            total += Math.floor((b64.length * 3) / 4);
            out.push({ name: clean(f.name, 255) || 'priloha', mime: clean(f.mime, 100), base64: b64, main: out.length === 0 });
        }
        if (total > MAX_SEND_BYTES) return NextResponse.json({ error: 'bad_request', message: 'Přílohy jsou dohromady větší než 10 MB.' }, { status: 400 });
        if (body.confirmSend !== true) return NextResponse.json({ error: 'confirm', message: 'Odeslání je třeba potvrdit.' }, { status: 409 });
        const r = await callIsds(env, 'dz', createRequest({ recipient, annotation, toHands: clean(body.toHands, 50) || undefined, senderRef: clean(body.senderRef, 50) || undefined, files: out }), cred);
        if (!r.ok) return fail(r);
        const res = parseCreated(r.xml);
        if (isFault(r.xml) || !isOk(res.status)) return NextResponse.json({ error: 'isds', message: res.status.message || 'Zprávu se nepodařilo odeslat.', code: res.status.code }, { status: 502, headers: NO_STORE });
        return NextResponse.json({ id: res.id }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { normalizeFio } from '@/lib/bank';
import { mfaBlocked } from '@/lib/serverMfa';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const NO_STORE = { 'Cache-Control': 'no-store' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Čtení pohybů z Fio API. Token (jen pro čtení) přichází s požadavkem zašifrovaný jen transportem, na serveru se neukládá ani nezapisuje do logů.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error: ue } = await user.auth.getUser(token);
    if (ue || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`bank:${u.user.id}`, 20, 60_000)) return NextResponse.json({ error: 'rate', message: 'Příliš mnoho požadavků, zkuste to za chvíli.' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const fioToken = typeof body?.token === 'string' ? body.token.trim() : '';
    const from = typeof body?.from === 'string' ? body.from : ''; const to = typeof body?.to === 'string' ? body.to : '';
    if (body?.action !== 'fio' || !/^[A-Za-z0-9]{40,100}$/.test(fioToken) || !DATE.test(from) || !DATE.test(to) || from > to) return NextResponse.json({ error: 'bad_request', message: 'Neplatný token nebo období.' }, { status: 400 });

    try {
        const res = await fetch(`https://fioapi.fio.cz/v1/rest/periods/${fioToken}/${from}/${to}/transactions.json`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(45_000) });
        if (res.status === 409) return NextResponse.json({ error: 'wait', message: 'Fio dovoluje stahovat jednou za 30 sekund. Zkuste to za chvíli.' }, { status: 409, headers: NO_STORE });
        if (res.status === 422) return NextResponse.json({ error: 'old', message: 'Fio nevydá data starší 90 dní bez dočasného odemknutí historie v internetovém bankovnictví. Zkraťte období.' }, { status: 422, headers: NO_STORE });
        if (res.status === 413) return NextResponse.json({ error: 'many', message: 'Za zvolené období je příliš mnoho pohybů. Zkraťte období.' }, { status: 413, headers: NO_STORE });
        if (res.status === 500 || res.status === 404) return NextResponse.json({ error: 'token', message: 'Fio token není platný, nebo nemá oprávnění ke čtení pohybů.' }, { status: 400, headers: NO_STORE });
        if (!res.ok) return NextResponse.json({ error: 'upstream', message: `Fio vrátilo chybu ${res.status}.` }, { status: 502, headers: NO_STORE });
        const json = await res.json().catch(() => null);
        const iban = ((json as { accountStatement?: { info?: { iban?: string } } } | null)?.accountStatement?.info?.iban) ?? '';
        return NextResponse.json({ transactions: normalizeFio(json), iban }, { headers: NO_STORE });
    } catch { return NextResponse.json({ error: 'upstream', message: 'Fio teď neodpovídá.' }, { status: 502, headers: NO_STORE }); }
}

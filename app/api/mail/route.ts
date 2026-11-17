import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { listFolders, listMessages, readAttachment, readMessage, sendMail, testAccount, validateCreds, type MailCreds, type OutMail } from '@/lib/mailServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const NO_STORE = { 'Cache-Control': 'no-store' };
export const maxDuration = 60;

const err = (e: unknown) => {
    const x = (e ?? {}) as { message?: string; code?: string; authenticationFailed?: boolean; responseText?: string; response?: string };
    const m = x.message ?? '';
    const detail = [m, x.code, x.responseText, x.response].filter(Boolean).join(' ');
    // Pro ladění se zapíše jen druh chyby, nikdy přihlašovací údaje
    console.warn(`[mail] ${x.code ?? ''} ${m} ${x.responseText ?? ''}`.trim());
    // Chybu přihlášení poznáme podle příznaku knihovny nebo podle odpovědi serveru
    if (x.authenticationFailed || /AUTHENTICATIONFAILED|EAUTH|Invalid credentials|Username and Password not accepted|Application-specific password|\b53[45]\b|credential|login failed/i.test(detail)) return NextResponse.json({ error: 'auth', message: 'Přihlášení do schránky se nepodařilo. U Gmailu a dalších služeb je potřeba „heslo pro aplikace“ (ne běžné heslo) a zapnuté dvoufázové ověření. Zkontrolujte také, že je ve schránce povolený přístup IMAP.' }, { status: 401 });
    if (/^(Tento server|Neplatn|Nepovolen|Chybí|Zpráva nebyla|Příloha)/.test(m)) return NextResponse.json({ error: 'bad_request', message: m }, { status: 400 });
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|timeout/i.test(detail)) return NextResponse.json({ error: 'upstream', message: 'K poštovnímu serveru se nepodařilo připojit. Zkontrolujte název serveru a port, nebo to zkuste za chvíli znovu.' }, { status: 502 });
    return NextResponse.json({ error: 'upstream', message: 'Poštovní server neodpověděl správně. Zkuste to za chvíli znovu.' }, { status: 502 });
};

// Přihlašovací údaje ke schránce přichází od prohlížeče (uložené zašifrované jeho hlavním klíčem) a použijí se na jedno volání.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error: ue } = await user.auth.getUser(token);
    if (ue || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (rateLimited(`mail:${u.user.id}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    let creds: MailCreds;
    try { creds = validateCreds(body.creds as Partial<MailCreds>); } catch (e) { return err(e); }
    const folder = typeof body.folder === 'string' && body.folder.length < 200 ? body.folder : 'INBOX';
    const uid = Number(body.uid);
    try {
        switch (body.action) {
            case 'test': return NextResponse.json(await testAccount(creds), { headers: NO_STORE });
            case 'folders': return NextResponse.json({ folders: await listFolders(creds) }, { headers: NO_STORE });
            case 'list': return NextResponse.json(await listMessages(creds, folder, { before: Number(body.before) || undefined, query: typeof body.query === 'string' ? body.query : undefined }), { headers: NO_STORE });
            case 'read': if (!Number.isInteger(uid)) throw new Error('Chybí zpráva.'); return NextResponse.json(await readMessage(creds, folder, uid, body.markSeen !== false), { headers: NO_STORE });
            case 'attachment': if (!Number.isInteger(uid)) throw new Error('Chybí zpráva.'); return NextResponse.json(await readAttachment(creds, folder, uid, Number(body.index)), { headers: NO_STORE });
            case 'send': {
                const m = body.mail as OutMail | undefined;
                if (!m || typeof m.to !== 'string' || !/[^\s@]+@[^\s@]+/.test(m.to) || typeof m.subject !== 'string' || typeof m.text !== 'string') throw new Error('Chybí příjemce nebo text.');
                const size = (m.attachments ?? []).reduce((s, a) => s + (a.base64?.length ?? 0), 0);
                if (size > 14 * 1024 * 1024) throw new Error('Přílohy jsou větší než 10 MB.');
                return NextResponse.json(await sendMail(creds, { ...m, to: m.to.slice(0, 500), subject: m.subject.slice(0, 300), text: m.text.slice(0, 200_000) }), { headers: NO_STORE });
            }
            default: return NextResponse.json({ error: 'bad_request' }, { status: 400 });
        }
    } catch (e) { return err(e); }
}

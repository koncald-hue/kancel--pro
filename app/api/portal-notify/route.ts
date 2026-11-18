import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIp, rateLimited } from '@/lib/serverSupabase';
import { mfaBlocked } from '@/lib/serverMfa';
import { isEmail, mailConfigured, maskEmail, sendMail } from '@/lib/mail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Upozornění klientovi, že ve věci je novinka. E-mail NEobsahuje žádný údaj o věci ani odkaz (odkaz má klient od advokáta,
// u šifrované stránky je klíč jen v něm). Odesílá jen vlastník věci, jen s výslovným potvrzením a jen na e-mail uložený u věci nebo odkazu.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`notify-ip:${clientIp(req)}`, 60, 60 * 60_000) || await rateLimited(`notify:${u.user.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null) as { caseId?: unknown; confirmed?: unknown } | null;
    const caseId = typeof body?.caseId === 'string' && /^[0-9a-f-]{36}$/i.test(body.caseId) ? body.caseId : '';
    if (!caseId) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    if (body?.confirmed !== true) return NextResponse.json({ error: 'not_confirmed' }, { status: 400 });
    // U jedné věci nejvýše tři upozornění za hodinu
    if (await rateLimited(`notify-case:${caseId}`, 3, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

    // Čte se přes přihlášeného uživatele, takže pravidla přístupu v databázi rozhodnou, co vidí
    const { data: c } = await user.from('cases').select('id, user_id, client_email').eq('id', caseId).maybeSingle();
    if (!c || c.user_id !== u.user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const { data: link } = await user.from('client_links').select('client_email, revoked, expires_at').eq('case_id', caseId).eq('user_id', u.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!link || link.revoked || (link.expires_at && new Date(link.expires_at as string) < new Date())) return NextResponse.json({ error: 'no_link' }, { status: 409 });
    const to = String(link.client_email || c.client_email || '').trim();
    if (!isEmail(to)) return NextResponse.json({ error: 'no_email' }, { status: 409 });
    if (!mailConfigured()) return NextResponse.json({ error: 'mail_off' }, { status: 503 });
    const { data: la } = await user.from('lawyer_access').select('display_name, firm_name').eq('user_id', u.user.id).maybeSingle();
    const who = String(la?.display_name || la?.firm_name || 'váš advokát').replace(/[\r\n]+/g, ' ').slice(0, 120);
    try {
        await sendMail(to, 'Nová informace ve vaší věci', `Dobrý den,\n\n${who} Vám ve Vaší věci zpřístupnil(a) novou informaci. Otevřete prosím svůj soukromý odkaz, který jste od advokáta dostali.\n\nTento e-mail záměrně neobsahuje žádné údaje o věci ani odkaz. Pokud odkaz už nemáte, požádejte advokáta o nový.\n`);
    } catch { return NextResponse.json({ error: 'mail_failed' }, { status: 502 }); }
    return NextResponse.json({ sent: true, to: maskEmail(to) }, { headers: { 'Cache-Control': 'no-store' } });
}

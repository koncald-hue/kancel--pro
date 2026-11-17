import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { mailConfigured, maskEmail, sendMail } from '@/lib/mail';
import { CODE_MAX_ATTEMPTS, CODE_TTL_MS, SESSION_TTL_MS, codeHash, newCode, newSession, readCookie, requiresCode, sameHash, sessionCookie, sha256, COOKIE, type FactorLink } from '@/lib/portalSession';

// Kód z e-mailu pro klientský odkaz: { action: 'send' } pošle kód, { action: 'verify', code } ho ověří a založí relaci,
// { action: 'logout' } relaci tohoto prohlížeče ukončí. E-mail s kódem neobsahuje nic o věci.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const ip = clientIp(req);
    if (await rateLimited(`pcode:${ip}`, 30, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token) as FactorLink | null;
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified || !link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });
    if (!requiresCode(link)) return NextResponse.json({ error: 'not-required' }, { status: 400 });

    const body = await req.json().catch(() => null) as { action?: unknown; code?: unknown } | null;
    const action = body?.action;

    if (action === 'send') {
        // Nejvýš 5 kódů za hodinu na odkaz (nezávisle na IP), aby nešlo zahltit schránku klienta
        if (await rateLimited(`pcode-send:${link.id}`, 5, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
        if (!mailConfigured()) return NextResponse.json({ error: 'mail-off' }, { status: 503 });
        const code = newCode();
        const { error } = await db.from('portal_sessions').insert({ link_id: link.id, code_hash: codeHash(link.id, code), code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() });
        if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
        try {
            await sendMail(link.code_email!, 'Kód pro otevření klientské stránky', `Dobrý den,\n\nkód pro otevření vaší klientské stránky je: ${code}\n\nKód platí 10 minut. Pokud jste o něj nežádali, nikomu ho nesdělujte a dejte vědět svému advokátovi.\n`);
        } catch { return NextResponse.json({ error: 'mail-failed' }, { status: 502 }); }
        return NextResponse.json({ sent: true, email: maskEmail(link.code_email!) });
    }

    if (action === 'verify') {
        const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
        if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
        const { data: row } = await db.from('portal_sessions').select('id, code_hash, attempts').eq('link_id', link.id).is('session_hash', null).not('code_hash', 'is', null).gt('code_expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!row) return NextResponse.json({ error: 'expired' }, { status: 400 });
        if (row.attempts >= CODE_MAX_ATTEMPTS) return NextResponse.json({ error: 'limit' }, { status: 429 });
        // Pokus se započítá dřív, než se kód porovná (a jen dokud není vyčerpán limit)
        const { data: counted } = await db.from('portal_sessions').update({ attempts: row.attempts + 1 }).eq('id', row.id).eq('attempts', row.attempts).select('id').maybeSingle();
        if (!counted) return NextResponse.json({ error: 'retry' }, { status: 409 });
        if (!sameHash(row.code_hash as string, codeHash(link.id, code))) return NextResponse.json({ error: 'mismatch', left: Math.max(0, CODE_MAX_ATTEMPTS - row.attempts - 1) }, { status: 400 });
        const session = newSession();
        const { error } = await db.from('portal_sessions').update({ code_hash: null, session_hash: sha256(session), session_expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(), verified_at: new Date().toISOString() }).eq('id', row.id);
        if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
        const res = NextResponse.json({ ok: true });
        res.headers.set('Set-Cookie', sessionCookie(token, session, Math.floor(SESSION_TTL_MS / 1000)));
        return res;
    }

    if (action === 'logout') {
        const value = readCookie(req, COOKIE);
        if (/^[0-9a-f]{64}$/.test(value)) await db.from('portal_sessions').delete().eq('link_id', link.id).eq('session_hash', sha256(value));
        const res = NextResponse.json({ ok: true });
        res.headers.set('Set-Cookie', sessionCookie(token, '', 0));
        return res;
    }
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
}

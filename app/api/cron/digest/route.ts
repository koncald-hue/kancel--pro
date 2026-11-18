import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { mailConfigured, sendMail } from '@/lib/mail';
import { clientDigestFor, digestFor } from '@/lib/digestServer';

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Týdenní souhrn (plánovač hostingu jednou týdně, např. v pondělí ráno, s hlavičkou Authorization: Bearer <CRON_SECRET>).
// Pošle se jen tomu, kdo ho zapnul, má aktivní přístup a za posledních 6 dní ho nedostal; prázdný týden se nepošle.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    if (!mailConfigured()) return NextResponse.json({ error: 'mail_off' }, { status: 503 });
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - 6 * 86_400_000).toISOString();
    let sent = 0, skipped = 0, failed = 0, clients = 0;

    const { data: subs } = await db.from('digest_settings').select('user_id, details, last_sent_at').eq('weekly', true);
    for (const s of (subs ?? []) as { user_id: string; details: boolean; last_sent_at: string | null }[]) {
        if (s.last_sent_at && s.last_sent_at > cutoff) { skipped++; continue; }
        const { data: ok } = await db.rpc('has_lawyer_access', { p_user: s.user_id });
        if (ok !== true) { skipped++; continue; }
        const { data: u } = await db.auth.admin.getUserById(s.user_id);
        const to = u?.user?.email; if (!to) { skipped++; continue; }
        const d = await digestFor(db, s.user_id, today, s.details);
        if (!d.worth) { skipped++; continue; }
        try { await sendMail(to, d.mail.subject, d.mail.text); sent++; await db.from('digest_settings').update({ last_sent_at: new Date().toISOString() }).eq('user_id', s.user_id); }
        catch { failed++; }
    }

    const { data: cl } = await db.from('client_digest').select('case_id, user_id, last_sent_at').eq('enabled', true);
    for (const c of (cl ?? []) as { case_id: string; user_id: string; last_sent_at: string | null }[]) {
        if (c.last_sent_at && c.last_sent_at > cutoff) continue;
        const { data: ok } = await db.rpc('has_lawyer_access', { p_user: c.user_id });
        if (ok !== true) continue;
        const m = await clientDigestFor(db, c.case_id, c.user_id, today);
        if (!m) continue;
        try { await sendMail(m.to, m.subject, m.text); clients++; await db.from('client_digest').update({ last_sent_at: new Date().toISOString() }).eq('case_id', c.case_id); }
        catch { failed++; }
    }
    return NextResponse.json({ sent, skipped, failed, clients });
}

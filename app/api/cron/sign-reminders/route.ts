import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { mailConfigured, sendMail } from '@/lib/mail';
import { planReminder, type ReminderRow } from '@/lib/signing';
import { buildClientReminder, buildExpiryNotice, remindersElapsed } from '@/lib/signReminders';

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
type Row = ReminderRow & { user_id: string; title: string; signer_name: string; package_id: string | null };

// Denně: nepodepsaným žádostem pošle klientovi připomínku po 2. a po 5. dni (má-li e-mail); po vypršení platnosti žádost označí jako vypršelou
// a jednou upozorní advokáta. Plánovač hostingu volá s hlavičkou Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    if (!mailConfigured()) return NextResponse.json({ error: 'mail_off' }, { status: 503 });
    const since = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const { data, error } = await db.from('signature_requests').select('id, user_id, title, signer_name, signer_email, status, level, created_at, expires_at, reminder_count, expiry_notified, package_id').eq('status', 'pending').gte('created_at', since).limit(2000);
    if (error) return NextResponse.json({ error: 'unavailable', hint: 'Chybí spuštění podpisy-balicky.sql.' }, { status: 503 });
    const now = new Date();
    const rows = (data ?? []) as Row[];
    let reminded = 0, expired = 0, failed = 0, skipped = 0;
    const access = new Map<string, boolean>();
    const hasAccess = async (u: string) => { if (!access.has(u)) access.set(u, (await db.rpc('has_lawyer_access', { p_user: u })).data === true); return access.get(u) as boolean; };

    // Dokumenty jednoho balíčku (nebo jedné žádosti) se klientovi připomínají jedním e-mailem
    const remind = new Map<string, Row[]>(); const expire = new Map<string, Row[]>();
    for (const r of rows) {
        const plan = planReminder(r, now);
        if (!plan) continue;
        const key = `${r.user_id}|${r.signer_email}|${r.package_id ?? r.id}`;
        const bucket = plan === 'remind' ? remind : expire;
        bucket.set(key, [...(bucket.get(key) ?? []), r]);
    }

    for (const group of remind.values()) {
        const first = group[0];
        if (!await hasAccess(first.user_id)) { skipped += group.length; continue; }
        const { data: la } = await db.from('lawyer_access').select('display_name, firm_name').eq('user_id', first.user_id).maybeSingle();
        const m = buildClientReminder({ lawyer: String(la?.display_name || la?.firm_name || ''), titles: group.map((g) => g.title), expiresAt: first.expires_at });
        try {
            await sendMail(first.signer_email, m.subject, m.text);
            for (const g of group) await db.from('signature_requests').update({ reminded_at: now.toISOString(), reminder_count: remindersElapsed(g.created_at, now) }).eq('id', g.id);
            reminded += group.length;
        } catch { failed += 1; }
    }

    for (const group of expire.values()) {
        const first = group[0];
        // Vypršení se zapíše vždy; e-mail advokátovi jen má-li přístup a adresu
        let notified = false;
        if (await hasAccess(first.user_id)) {
            const { data: u } = await db.auth.admin.getUserById(first.user_id);
            const to = u?.user?.email;
            if (to) { const m = buildExpiryNotice({ who: first.signer_name, titles: group.map((g) => g.title) }); try { await sendMail(to, m.subject, m.text); notified = true; } catch { failed += 1; } }
        }
        if (!notified) { skipped += group.length; continue; }
        for (const g of group) await db.from('signature_requests').update({ status: 'expired', expiry_notified: true }).eq('id', g.id).eq('status', 'pending');
        expired += group.length;
    }
    return NextResponse.json({ reminded, expired, skipped, failed });
}

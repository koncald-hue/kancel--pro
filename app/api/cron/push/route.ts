import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { serviceClient } from '@/lib/serverSupabase';
import { buildPushMessage, countDeadlines } from '@/lib/push';

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Ranní upozornění na lhůty (plánovač hostingu jednou denně, s hlavičkou Authorization: Bearer <CRON_SECRET>).
// Posílá se jen tomu, kdo upozornění zapnul a má aktivní přístup; každé zařízení nejvýš jednou za den; bez lhůt se neposílá nic.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, subject = process.env.VAPID_SUBJECT;
    const db = serviceClient();
    if (!db || !pub || !priv || !subject) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    webpush.setVapidDetails(subject, pub, priv);
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
    let sent = 0, skipped = 0, removed = 0, failed = 0;

    const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, last_sent_on');
    const byUser = new Map<string, NonNullable<typeof subs>>();
    for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

    for (const [userId, list] of byUser) {
        const todo = list.filter((s) => s.last_sent_on !== today);
        if (!todo.length) { skipped += list.length; continue; }
        const { data: ok } = await db.rpc('has_lawyer_access', { p_user: userId });
        if (ok !== true) { skipped += todo.length; continue; }
        const { data: cases } = await db.from('cases').select('id').eq('user_id', userId).neq('status', 'done');
        const ids = (cases ?? []).map((c) => c.id as string);
        const rows = ids.length ? (await db.from('case_deadlines').select('due_date').in('case_id', ids).eq('done', false).lte('due_date', new Date(Date.parse(`${today}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10))).data ?? [] : [];
        const msg = buildPushMessage(countDeadlines(rows as { due_date: string }[], today), today);
        if (!msg) { skipped += todo.length; continue; }
        for (const s of todo) {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: 'high' });
                await db.from('push_subscriptions').update({ last_sent_on: today }).eq('id', s.id); sent++;
            } catch (e) {
                const code = (e as { statusCode?: number }).statusCode;
                if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('id', s.id); removed++; } else failed++;
            }
        }
    }
    return NextResponse.json({ sent, skipped, removed, failed });
}

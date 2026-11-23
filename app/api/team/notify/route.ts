import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';
import { mailConfigured, sendMail } from '@/lib/mail';
import { getSiteOrigin } from '@/lib/siteUrl';

// Okamžité doručení týmových upozornění (nový úkol, pozvánka do kalendáře, příspěvek na nástěnce).
// Volá ho prohlížeč toho, kdo akci udělal. Posílají se jen upozornění, která vznikla z jeho vlastní akce
// (actor_id = on) a ještě nebyla odeslaná. Kdo má zapnuté upozornění v telefonu nebo počítači, dostane push;
// kdo ne, dostane krátký e-mail. Text je obecný, bez obsahu úkolu (zamčená obrazovka ho může ukázat komukoli).
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder', { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (await rateLimited(`tn:${u.user.id}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: rows, error: qErr } = await db.from('team_notifications').select('id, user_id, kind, link').eq('actor_id', u.user.id).is('pushed_at', null).gte('created_at', since).limit(100);
    if (qErr) return NextResponse.json({ error: 'not_migrated' }, { status: 503 });
    if (!rows?.length) return NextResponse.json({ ok: true, sent: 0 });
    await db.from('team_notifications').update({ pushed_at: new Date().toISOString() }).in('id', rows.map((r) => r.id));

    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, subject = process.env.VAPID_SUBJECT;
    const pushOn = !!(pub && priv && subject);
    if (pushOn) webpush.setVapidDetails(subject!, pub!, priv!);
    const { data: me } = await db.from('lawyer_access').select('display_name, email').eq('user_id', u.user.id).maybeSingle();
    const who = String(me?.display_name || me?.email || 'Kolega');
    const origin = getSiteOrigin() ?? '';
    const label = (kind: string) => kind === 'task' ? 'vám zadal(a) úkol' : kind === 'task_done' ? 'splnil(a) úkol' : kind === 'task_declined' ? 'odmítl(a) úkol' : kind === 'post' ? 'přidal(a) příspěvek na nástěnku' : kind === 'event_moved' ? 'změnil(a) termín události' : 'vás přidal(a) do kalendáře';

    let sent = 0;
    const byUser = new Map<string, { kind: string; link: string }[]>();
    for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), { kind: r.kind, link: r.link }]);
    for (const [userId, items] of byUser) {
        const first = items[0];
        const body = items.length > 1 ? `${who}: ${items.length} nové položky v Kanceláři` : `${who} ${label(first.kind)}`;
        const subs = pushOn ? (await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)).data ?? [] : [];
        let delivered = false;
        for (const s of subs) {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: 'Kancelář Pro', body, tag: `team-${first.kind}`, url: first.link }), { TTL: 24 * 3600, urgency: 'high' });
                delivered = true; sent++;
            } catch (e) {
                const code = (e as { statusCode?: number }).statusCode;
                if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
            }
        }
        if (!delivered && mailConfigured()) {
            const { data: to } = await db.from('lawyer_access').select('email, contact_email').eq('user_id', userId).maybeSingle();
            const addr = String(to?.email || to?.contact_email || '');
            if (addr) {
                await sendMail(addr, `Kancelář Pro: ${body}`, [`${body}.`, '', `Otevřít: ${origin}${first.link}`, '', 'Upozornění rovnou do telefonu nebo počítače si zapnete v Kanceláři v Nastavení, záložka Aplikace a upozornění.'].join('\n')).then(() => { sent++; }, () => undefined);
            }
        }
    }
    return NextResponse.json({ ok: true, sent });
}

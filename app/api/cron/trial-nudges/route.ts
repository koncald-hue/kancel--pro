import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { mailConfigured, sendMail } from '@/lib/mail';
import { getSiteOrigin } from '@/lib/siteUrl';
import { buildNudge, planNudge, type NudgeKind } from '@/lib/trialNudges';

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
type Row = { user_id: string; email: string; status: string; until: string | null; created_at: string; display_name: string | null; nudge_day2_at: string | null; nudge_day5_at: string | null };

// Denně: zkušebním uživatelům pošle e-mail po 2. a po 5. dni s dalším krokem podle toho, co už udělali.
// Plánovač hostingu volá s hlavičkou Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    if (!mailConfigured()) return NextResponse.json({ error: 'mail_off' }, { status: 503 });
    const since = new Date(Date.now() - 13 * 86_400_000).toISOString();
    const { data, error } = await db.from('lawyer_access').select('user_id, email, status, until, created_at, display_name, nudge_day2_at, nudge_day5_at').eq('status', 'trial').gte('created_at', since).limit(1000);
    if (error) return NextResponse.json({ error: 'unavailable', hint: 'Chybí spuštění zkusebni-e-maily.sql.' }, { status: 503 });
    const now = new Date(); const origin = getSiteOrigin() ?? '';
    const count = async (table: string, userId: string) => { const r = await db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId); return r.error ? 1 : r.count ?? 0; };
    let sent = 0, skipped = 0, failed = 0;
    for (const r of (data ?? []) as Row[]) {
        const kind: NudgeKind | null = planNudge(r, now);
        if (!kind || !r.email) { skipped++; continue; }
        const [cases, clients, links, time] = await Promise.all([count('cases', r.user_id), count('lawyer_clients', r.user_id), count('client_links', r.user_id), count('time_entries', r.user_id)]);
        const daysLeft = r.until ? Math.ceil((new Date(`${r.until}T23:59:59Z`).getTime() - now.getTime()) / 86_400_000) : null;
        const m = buildNudge(kind, { name: (r.display_name ?? '').trim(), progress: { cases, clients, links, time }, daysLeft, appUrl: origin });
        try {
            await sendMail(r.email, m.subject, m.text);
            await db.from('lawyer_access').update(kind === 'day2' ? { nudge_day2_at: now.toISOString() } : { nudge_day5_at: now.toISOString() }).eq('user_id', r.user_id);
            sent++;
        } catch { failed++; }
    }
    return NextResponse.json({ sent, skipped, failed });
}

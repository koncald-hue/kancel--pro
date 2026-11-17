import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { buildFeed, type FeedEvent } from '@/lib/calendarFeed';
import { collectDeadlines, type CaseDeadline } from '@/lib/caseFile';
import type { LegalCase } from '@/lib/cases';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Odběr kalendáře lhůt: adresa s tajným tokenem, bez přihlášení (kalendářní aplikace se nepřihlašují). Token je dlouhý náhodný řetězec.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token: raw } = await ctx.params;
    const token = raw.replace(/\.ics$/i, '');
    if (!/^[A-Za-z0-9_-]{32,80}$/.test(token)) return new NextResponse('Not found', { status: 404 });
    if (await rateLimited(`cal:${clientIp(req)}`, 120, 60 * 60_000)) return new NextResponse('Too many requests', { status: 429 });
    const db = serviceClient();
    if (!db) return new NextResponse('Unavailable', { status: 503 });
    const { data: feed } = await db.from('calendar_feeds').select('user_id, include_titles').eq('token', token).maybeSingle();
    if (!feed) return new NextResponse('Not found', { status: 404 });
    const uid = feed.user_id as string;
    // Funguje jen s platným přístupem advokáta
    // (has_lawyer_access kontroluje provozovatele podle přihlášeného uživatele, který tu není, proto se staff čte zvlášť)
    const { data: ok } = await db.rpc('has_lawyer_access', { p_user: uid });
    const { data: staff } = ok === true ? { data: null } : await db.from('staff').select('user_id').eq('user_id', uid).maybeSingle();
    if (ok !== true && !staff) return new NextResponse('Not found', { status: 404 });

    const shared = await db.from('case_members').select('case_id').eq('user_id', uid);
    const sharedIds = shared.error ? [] : ((shared.data ?? []) as { case_id: string }[]).map((m) => m.case_id);
    const [own, other] = await Promise.all([
        db.from('cases').select('id, title, event_date, deadline_ids, status').eq('user_id', uid).eq('status', 'open'),
        sharedIds.length ? db.from('cases').select('id, title, event_date, deadline_ids, status').in('id', sharedIds).eq('status', 'open') : Promise.resolve({ data: [] as unknown[] }),
    ]);
    const cases = [...((own.data ?? []) as LegalCase[]), ...((other.data ?? []) as LegalCase[])];
    const ids = cases.map((c) => c.id);
    const customs = ids.length ? ((await db.from('case_deadlines').select('id, case_id, title, due_date, done').in('case_id', ids).eq('done', false)).data ?? []) as CaseDeadline[] : [];

    const from = new Date(Date.now() - 7 * 86_400_000); const to = new Date(Date.now() + 400 * 86_400_000);
    const events: FeedEvent[] = [];
    for (const c of cases) {
        for (const d of collectDeadlines(c, customs.filter((x) => x.case_id === c.id))) {
            if (d.done || d.date < from || d.date > to) continue;
            events.push({ uid: `${c.id}-${d.key}`, iso: iso(d.date), title: d.title, caseId: c.id, caseTitle: c.title });
        }
    }
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || new URL(req.url).origin;
    const body = buildFeed(events.sort((a, b) => a.iso.localeCompare(b.iso)), { includeTitles: feed.include_titles === true, origin });
    return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="kancelar-lhuty.ics"', 'Cache-Control': 'private, no-store, max-age=0' } });
}

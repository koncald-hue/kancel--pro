import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { buildFeed, type FeedEvent } from '@/lib/calendarFeed';
import { pragueParts, pragueToIso } from '@/lib/agenda';
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
    // Úkoly pro mě (od kolegů i vlastní) a události, které pořádám nebo na které jsem pozván (migrace 20261118_21)
    const [tt, ce] = await Promise.all([
        db.from('team_tasks').select('id, title, due_date, due_time, case_title').eq('assignee_id', uid).eq('status', 'open').gte('due_date', iso(from)).lte('due_date', iso(to)),
        db.from('calendar_events').select('id, title, starts_at, ends_at, all_day, place, case_title, user_id, attendees').or(`user_id.eq.${uid},attendees.cs.{${uid}}`).gte('ends_at', from.toISOString()).lte('starts_at', to.toISOString()),
    ]);
    for (const t of (tt.error ? [] : tt.data ?? []) as { id: string; title: string; due_date: string; due_time: string | null; case_title: string }[]) {
        const start = t.due_time ? pragueToIso(t.due_date, t.due_time.slice(0, 5)) : undefined;
        events.push({ uid: `task-${t.id}`, iso: t.due_date, title: t.title, caseId: null, caseTitle: t.case_title, type: 'ukol', ...(start ? { startUtc: start, endUtc: new Date(Date.parse(start) + 30 * 60_000).toISOString() } : {}) });
    }
    for (const e of (ce.error ? [] : ce.data ?? []) as { id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; place: string; case_title: string }[]) {
        const s = pragueParts(e.starts_at).date;
        events.push({ uid: `ev-${e.id}`, iso: s, title: e.title, caseId: null, caseTitle: e.case_title, type: 'udalost', place: e.place, ...(e.all_day ? {} : { startUtc: new Date(e.starts_at).toISOString(), endUtc: new Date(e.ends_at).toISOString() }) });
    }
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || new URL(req.url).origin;
    const body = buildFeed(events.sort((a, b) => a.iso.localeCompare(b.iso)), { includeTitles: feed.include_titles === true, origin });
    return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="kancelar-lhuty.ics"', 'Cache-Control': 'private, no-store, max-age=0' } });
}

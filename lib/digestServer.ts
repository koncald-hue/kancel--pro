import type { SupabaseClient } from '@supabase/supabase-js';
import { buildClientDigest, buildDigest, hasAnything, type DigestDeadline, type DigestInput } from './digest';
import { getSiteOrigin } from './siteUrl';

// Data pro týdenní souhrn jednoho advokáta (server, služební klíč): jen jeho vlastní věci a věci, kde ho právě někdo zastupuje.
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function collectDigest(db: SupabaseClient, userId: string, today: string, details: boolean, appUrl?: string): Promise<DigestInput> {
    const week = addDays(today, 7); const since = `${addDays(today, -7)}T00:00:00Z`;
    const [la, cases] = await Promise.all([
        db.from('lawyer_access').select('display_name').eq('user_id', userId).maybeSingle(),
        db.from('cases').select('id, title, status, archive_until, disposal').eq('user_id', userId),
    ]);
    const myCases = (cases.data ?? []) as { id: string; title: string; status: string; archive_until: string | null; disposal: string | null }[];
    const title = new Map(myCases.map((c) => [c.id, c.title]));
    const ids = myCases.map((c) => c.id);
    const none = Promise.resolve({ data: [] as unknown[] });
    const [dl, ev, te, inv, inq, subs, mail] = await Promise.all([
        ids.length ? db.from('case_deadlines').select('case_id, title, due_date, kind').in('case_id', ids).eq('done', false).lte('due_date', week) : none,
        ids.length ? db.from('case_entries').select('case_id').in('case_id', ids).gte('created_at', since) : none,
        db.from('time_entries').select('minutes, rate').eq('user_id', userId).eq('billed', false),
        db.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'issued').lt('due_date', today),
        db.from('lawyer_inquiries').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'new').gte('created_at', since),
        db.from('substitutions').select('user_id, to_on').eq('substitute_id', userId).lte('from_on', today).gte('to_on', today),
        db.from('mail_log').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('direction', 'out').in('channel', ['datovka', 'listinna']).is('delivered_on', null).gte('event_on', addDays(today, -60)),
    ]);
    const deadlines = ((dl.data ?? []) as { case_id: string; title: string; due_date: string; kind: string | null }[]).map((d): DigestDeadline => ({ title: d.title, due_date: d.due_date, case_title: title.get(d.case_id) ?? '', kind: d.kind === 'ukol' ? 'ukol' : 'lhuta' })).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const counts = new Map<string, number>();
    for (const e of (ev.data ?? []) as { case_id: string }[]) counts.set(e.case_id, (counts.get(e.case_id) ?? 0) + 1);
    const entries = (te.data ?? []) as { minutes: number; rate: number }[];
    // Zastupování: jméno nepřítomného a počet jeho termínů na týden (bez názvů, ty uvidí zástupce v aplikaci)
    const substituting: DigestInput['substituting'] = [];
    for (const s of ((subs.error ? [] : subs.data) ?? []) as { user_id: string; to_on: string }[]) {
        const [p, theirCases] = await Promise.all([db.from('lawyer_access').select('display_name, email').eq('user_id', s.user_id).maybeSingle(), db.from('cases').select('id').eq('user_id', s.user_id)]);
        const cids = ((theirCases.data ?? []) as { id: string }[]).map((c) => c.id);
        const n = cids.length ? (await db.from('case_deadlines').select('id', { count: 'exact', head: true }).in('case_id', cids).eq('done', false).lte('due_date', week)).count ?? 0 : 0;
        substituting.push({ name: String(p.data?.display_name || p.data?.email || 'kolega'), to_on: s.to_on, deadlines: n });
    }
    return {
        name: String(la.data?.display_name ?? ''), today, details, appUrl: appUrl ?? getSiteOrigin() ?? '',
        overdue: deadlines.filter((d) => d.due_date < today), upcoming: deadlines.filter((d) => d.due_date >= today),
        caseEvents: [...counts.entries()].map(([id, count]) => ({ case_title: title.get(id) ?? '', count })).sort((a, b) => b.count - a.count),
        unbilledMinutes: entries.reduce((s, e) => s + e.minutes, 0), unbilledAmount: entries.reduce((s, e) => s + (e.minutes * Number(e.rate)) / 60, 0),
        overdueInvoices: inv.count ?? 0, newInquiries: inq.count ?? 0, substituting,
        archiveExpired: myCases.filter((c) => c.archive_until && c.archive_until <= today && !c.disposal).length,
        deliveriesPending: mail.error ? 0 : mail.count ?? 0,
    };
}

export async function digestFor(db: SupabaseClient, userId: string, today: string, details: boolean, appUrl?: string) {
    const input = await collectDigest(db, userId, today, details, appUrl);
    return { input, mail: buildDigest(input), worth: hasAnything(input) };
}

// Klientský přehled pro jednu věc: počet nových informací viditelných klientovi a jeho otevřených úkolů
export async function clientDigestFor(db: SupabaseClient, caseId: string, userId: string, today: string) {
    const since = `${today.slice(0, 10)}T00:00:00Z`;
    const weekAgo = new Date(Date.parse(since) - 7 * 86_400_000).toISOString();
    const [news, tasks, la, link] = await Promise.all([
        db.from('case_entries').select('id', { count: 'exact', head: true }).eq('case_id', caseId).eq('client_visible', true).gte('created_at', weekAgo),
        db.from('client_requests').select('id', { count: 'exact', head: true }).eq('case_id', caseId).eq('done', false),
        db.from('lawyer_access').select('display_name, firm_name').eq('user_id', userId).maybeSingle(),
        db.from('client_links').select('client_email, revoked, expires_at').eq('case_id', caseId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const l = link.data as { client_email?: string; revoked?: boolean; expires_at?: string | null } | null;
    const to = String(l?.client_email ?? '').trim();
    if (!l || l.revoked || (l.expires_at && new Date(l.expires_at) < new Date()) || !to) return null;
    const mail = buildClientDigest({ who: String(la.data?.display_name || la.data?.firm_name || 'Váš advokát'), news: news.count ?? 0, tasks: tasks.error ? 0 : tasks.count ?? 0 });
    return mail ? { to, ...mail } : null;
}

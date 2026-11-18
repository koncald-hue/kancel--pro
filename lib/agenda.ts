// Kalendář kanceláře: lhůty a úkoly z věcí, úkoly mezi kolegy a události (jednání, schůzky) v jednom přehledu.
// Časy se zobrazují v pražském čase bez ohledu na časové pásmo počítače.
export type ItemKind = 'lhuta' | 'ukol' | 'tym' | 'udalost';
export type AgendaItem = { id: string; kind: ItemKind; date: string; start?: string; end?: string; title: string; sub: string; href: string; done: boolean; high?: boolean };
export type TeamTask = { id: string; created_by: string; assignee_id: string; title: string; note: string; due_date: string; due_time: string | null; priority: 'normal' | 'high'; case_id: string | null; case_title: string; status: 'open' | 'done' | 'declined'; done_at: string | null; answer: string; seen_at: string | null; created_at: string };
export type CalEvent = { id: string; user_id: string; title: string; kind: 'jednani' | 'schuzka' | 'telefon' | 'osobni' | 'jine'; starts_at: string; ends_at: string; all_day: boolean; place: string; note: string; case_id: string | null; case_title: string; attendees: string[] };
export const EVENT_KIND: Record<CalEvent['kind'], string> = { jednani: 'Jednání', schuzka: 'Schůzka', telefon: 'Telefonát', osobni: 'Osobní', jine: 'Jiné' };
export const KIND_LABEL: Record<ItemKind, string> = { lhuta: 'Lhůta', ukol: 'Úkol ve věci', tym: 'Úkol od kolegy', udalost: 'Událost' };

const TZ = 'Europe/Prague';
const parts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
export function pragueParts(iso: string): { date: string; time: string } { const p = parts(new Date(iso)); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; }
// Pražské datum a čas na okamžik v UTC (zohlední letní čas)
export function pragueToIso(date: string, time = '00:00'): string {
    const [y, m, d] = date.split('-').map(Number); const [hh, mm] = time.split(':').map(Number);
    let guess = Date.UTC(y, m - 1, d, hh, mm);
    for (let i = 0; i < 3; i++) { const p = parts(new Date(guess)); const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); guess += Date.UTC(y, m - 1, d, hh, mm) - shown; }
    return new Date(guess).toISOString();
}
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function taskItems(tasks: TeamTask[], me: string, names: Record<string, string>): AgendaItem[] {
    return tasks.filter((t) => t.status !== 'declined' && (t.assignee_id === me || t.created_by === me)).map((t) => ({
        id: `tym-${t.id}`, kind: 'tym' as const, date: t.due_date, start: t.due_time?.slice(0, 5) || undefined, title: t.title,
        sub: [t.assignee_id === me ? (t.created_by === me ? 'můj úkol' : `od ${names[t.created_by] ?? 'kolegy'}`) : `pro ${names[t.assignee_id] ?? 'kolegu'}`, t.case_title].filter(Boolean).join(' · '),
        href: '/kancelar/ukoly', done: t.status === 'done', high: t.priority === 'high',
    }));
}

// Událost přes více dní se ukáže v každém dni; celodenní bez času
export function eventItems(events: CalEvent[], me: string, names: Record<string, string>): AgendaItem[] {
    const out: AgendaItem[] = [];
    for (const e of events) {
        const s = pragueParts(e.starts_at), f = pragueParts(e.ends_at);
        const last = e.all_day ? (f.date > s.date ? f.date : s.date) : f.date;
        let day = s.date; let guard = 0;
        while (day <= last && guard++ < 32) {
            out.push({ id: `ev-${e.id}-${day}`, kind: 'udalost', date: day, start: e.all_day ? undefined : day === s.date ? s.time : '00:00', end: e.all_day ? undefined : day === f.date ? f.time : '24:00',
                title: e.title, sub: [EVENT_KIND[e.kind], e.place, e.case_title, e.user_id !== me ? `pozval(a) ${names[e.user_id] ?? 'kolega'}` : ''].filter(Boolean).join(' · '), href: `/kancelar/kalendar?udalost=${e.id}`, done: false });
            day = addDays(day, 1);
        }
    }
    return out;
}

export function sortItems(items: AgendaItem[]): AgendaItem[] {
    const rank: Record<ItemKind, number> = { lhuta: 0, udalost: 1, tym: 2, ukol: 3 };
    return [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '') || rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title, 'cs'));
}
export function byDate(items: AgendaItem[]): Record<string, AgendaItem[]> {
    const m: Record<string, AgendaItem[]> = {};
    for (const i of sortItems(items)) (m[i.date] ??= []).push(i);
    return m;
}

// Mřížka měsíce od pondělí: 5 nebo 6 týdnů po 7 dnech
export function monthGrid(ym: string): string[][] {
    const first = `${ym}-01`;
    const dow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
    let day = addDays(first, -dow);
    const weeks: string[][] = [];
    do { const w: string[] = []; for (let i = 0; i < 7; i++) { w.push(day); day = addDays(day, 1); } weeks.push(w); } while (day.slice(0, 7) === ym);
    return weeks;
}
export const weekOf = (date: string) => { const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; const mon = addDays(date, -dow); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); };
export const shiftMonth = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

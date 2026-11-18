import { isWeekendOrHoliday } from './workdays';

// Přehled pro vedení: čistá logika (měsíc proti minulému, prognóza, hodiny podle týdnů a věcí)
export type Entry = { case_id: string | null; entry_date: string; minutes: number; rate: number; billed: boolean };
export type Sum = { minutes: number; amount: number; billedMinutes: number; billedAmount: number };

const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const monthOf = (iso: string) => iso.slice(0, 7);
export function shiftMonth(ym: string, delta: number): string { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
export const monthStart = (ym: string) => `${ym}-01`;
export const monthEnd = (ym: string) => { const [y, m] = ym.split('-').map(Number); return fmt(new Date(y, m, 0)); };

export const emptySum = (): Sum => ({ minutes: 0, amount: 0, billedMinutes: 0, billedAmount: 0 });
export function sumEntries(entries: Entry[]): Sum {
    return entries.reduce((s, e) => { const a = (e.minutes / 60) * e.rate; s.minutes += e.minutes; s.amount += a; if (e.billed) { s.billedMinutes += e.minutes; s.billedAmount += a; } return s; }, emptySum());
}
export const inMonth = (entries: Entry[], ym: string) => entries.filter((e) => monthOf(e.entry_date) === ym);

// Pracovní dny v měsíci (bez víkendů a svátků); `upTo` omezí na dny do daného data včetně
export function workdaysIn(ym: string, upTo?: string): number {
    const end = parse(upTo && monthOf(upTo) === ym ? upTo : monthEnd(ym)); let n = 0;
    for (const d = parse(monthStart(ym)); d <= end; d.setDate(d.getDate() + 1)) if (!isWeekendOrHoliday(d).isHoliday) n++;
    return n;
}

export type Forecast = { elapsed: number; total: number; minutes: number; amount: number; reliable: boolean };
// Prognóza: dosavadní tempo na pracovní den krát počet pracovních dnů měsíce. Do 3 pracovních dnů je to jen hrubý odhad.
export function forecast(entries: Entry[], today: string): Forecast {
    const ym = monthOf(today); const s = sumEntries(inMonth(entries, ym));
    const total = workdaysIn(ym); const elapsed = Math.max(1, Math.min(total, workdaysIn(ym, today)));
    return { elapsed, total, minutes: Math.round((s.minutes / elapsed) * total), amount: (s.amount / elapsed) * total, reliable: elapsed >= 4 };
}

// Změna proti minulému měsíci v procentech; null, když není s čím srovnávat
export const changePct = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

// Pondělí týdne, do kterého datum patří
export function weekStart(iso: string): string { const d = parse(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); }
export function byWeek(entries: Entry[]): { week: string; minutes: number; amount: number }[] {
    const m = new Map<string, { minutes: number; amount: number }>();
    for (const e of entries) { const k = weekStart(e.entry_date); const c = m.get(k) ?? { minutes: 0, amount: 0 }; c.minutes += e.minutes; c.amount += (e.minutes / 60) * e.rate; m.set(k, c); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, v]) => ({ week, ...v }));
}
export function byCase(entries: Entry[]): { caseId: string | null; minutes: number; amount: number }[] {
    const m = new Map<string | null, { minutes: number; amount: number }>();
    for (const e of entries) { const c = m.get(e.case_id) ?? { minutes: 0, amount: 0 }; c.minutes += e.minutes; c.amount += (e.minutes / 60) * e.rate; m.set(e.case_id, c); }
    return [...m.entries()].map(([caseId, v]) => ({ caseId, ...v })).sort((a, b) => b.amount - a.amount);
}

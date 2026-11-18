// Opakovaná fakturace (paušál měsíčně, čtvrtletně, ročně): které šablony jsou na řadě a za jaké období.
export type Every = 'month' | 'quarter' | 'year';
export type Recurring = { id: string; title: string; every: Every; next_on: string; active: boolean; last_period: string | null };
export const EVERY_LABEL: Record<Every, string> = { month: 'každý měsíc', quarter: 'každé čtvrtletí', year: 'každý rok' };

const pad = (n: number) => String(n).padStart(2, '0');
// Označení období, za které se fakturuje: 2026-11, 2026-Q4, 2026
export function periodOf(iso: string, every: Every): string {
    const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
    return every === 'month' ? `${y}-${pad(m)}` : every === 'quarter' ? `${y}-Q${Math.floor((m - 1) / 3) + 1}` : String(y);
}
export function periodLabel(period: string): string {
    const q = period.match(/^(\d{4})-Q([1-4])$/); if (q) return `${q[2]}. čtvrtletí ${q[1]}`;
    const m = period.match(/^(\d{4})-(\d{2})$/); if (m) return `${['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'][Number(m[2]) - 1]} ${m[1]}`;
    return `rok ${period}`;
}
// Další termín: o měsíc, čtvrtletí nebo rok dál; 31. 1. + měsíc = 28./29. 2. (poslední den měsíce)
export function nextOn(iso: string, every: Every): string {
    const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
    const add = every === 'month' ? 1 : every === 'quarter' ? 3 : 12;
    const tm = m - 1 + add; const ny = y + Math.floor(tm / 12); const nm = (tm % 12) + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}
// Na řadě jsou aktivní šablony s termínem dnes nebo dřív, za období, které ještě nebylo vyfakturováno
export function dueNow<T extends Recurring>(list: T[], today: string): T[] {
    return list.filter((r) => r.active && r.next_on <= today && r.last_period !== periodOf(r.next_on, r.every));
}

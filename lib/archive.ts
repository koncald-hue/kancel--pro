// Archiv a skartace spisů: výchozí lhůta uložení, stav archivu a protokol pro tisk nebo účetní kontrolu.
// Délku uložení určuje advokát podle stavovských předpisů a povahy věci; výchozích 10 let je jen předvyplněná hodnota.
export const DEFAULT_YEARS = 10;
export type ArchiveAction = 'archivace' | 'prodlouzeni' | 'vydani' | 'skartace' | 'zruseni';
export const ACTION_LABEL: Record<ArchiveAction, string> = { archivace: 'Archivace', prodlouzeni: 'Prodloužení lhůty', vydani: 'Vydání spisu', skartace: 'Skartace', zruseni: 'Zrušení archivace' };

export function addYears(iso: string, years: number): string {
    const y = Number(iso.slice(0, 4)) + years, m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export type ArchState = 'aktivni' | 'k-archivaci' | 'archiv' | 'brzy' | 'uplynulo' | 'vydano' | 'skartovano';
export const STATE_LABEL: Record<ArchState, string> = { aktivni: 'Otevřená věc', 'k-archivaci': 'Uzavřená, nearchivovaná', archiv: 'V archivu', brzy: 'Lhůta končí do 90 dní', uplynulo: 'Lhůta uplynula', vydano: 'Vydáno', skartovano: 'Skartováno' };

export function archState(c: { status: string; archived_on?: string | null; archive_until?: string | null; disposal?: string | null }, today: string): ArchState {
    if (c.disposal === 'vydano') return 'vydano';
    if (c.disposal === 'skartovano') return 'skartovano';
    if (!c.archived_on) return c.status === 'done' ? 'k-archivaci' : 'aktivni';
    if (c.archive_until && c.archive_until <= today) return 'uplynulo';
    if (c.archive_until && c.archive_until <= addDays(today, 90)) return 'brzy';
    return 'archiv';
}
function addDays(iso: string, n: number) { return new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10); }

export type LogRow = { done_on: string; action: ArchiveAction; case_title: string; until_on: string | null; place: string; note: string };
export function protocolCsv(rows: LogRow[]): string {
    const q = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const d = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}` : '');
    return '﻿' + ['Datum;Úkon;Věc;Uložit do;Místo;Poznámka', ...rows.map((r) => [d(r.done_on), ACTION_LABEL[r.action], q(r.case_title), d(r.until_on), q(r.place), q(r.note)].join(';'))].join('\r\n') + '\r\n';
}

// Lhůty na nejbližších 14 dní pro čtení bez připojení (volitelné, ve výchozím stavu vypnuté).
// Ukládá se jen název lhůty, datum a název věci, nikdy obsah spisu ani údaje klienta. Po odhlášení se smaže.
export const OFFLINE_KEY = 'kancelar-offline-deadlines';
export const OFFLINE_ENABLED_KEY = 'kancelar-offline-enabled';
export const OFFLINE_DAYS = 14;

export type OfflineItem = { title: string; due: string; caseTitle: string };
export type OfflineData = { savedAt: string; items: OfflineItem[] };

type DeadlineRow = { case_id: string; title: string; due_date: string; done: boolean };
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Nesplněné lhůty od dneška do konce okna, od nejbližší; text se ořízne, aby se do zařízení nedostalo víc, než je nutné
export function pickUpcoming(rows: DeadlineRow[], cases: { id: string; title: string }[], today: string, days = OFFLINE_DAYS): OfflineItem[] {
    const end = addDays(today, days); const titles = new Map(cases.map((c) => [c.id, c.title]));
    return rows.filter((r) => !r.done && r.due_date >= today && r.due_date <= end)
        .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'cs'))
        .slice(0, 100).map((r) => ({ title: r.title.slice(0, 140), due: r.due_date, caseTitle: (titles.get(r.case_id) ?? '').slice(0, 100) }));
}

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
export const isOfflineEnabled = () => safe(() => localStorage.getItem(OFFLINE_ENABLED_KEY) === '1', false);
export const saveOffline = (items: OfflineItem[], now = new Date()) => safe(() => localStorage.setItem(OFFLINE_KEY, JSON.stringify({ savedAt: now.toISOString(), items } satisfies OfflineData)), undefined);
export const clearOffline = () => safe(() => localStorage.removeItem(OFFLINE_KEY), undefined);
export function setOfflineEnabled(on: boolean) { safe(() => { if (on) localStorage.setItem(OFFLINE_ENABLED_KEY, '1'); else { localStorage.removeItem(OFFLINE_ENABLED_KEY); localStorage.removeItem(OFFLINE_KEY); } }, undefined); }

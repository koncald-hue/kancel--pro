import { round2 } from './billing';

// Rentabilita věci a klienta. Počítá se z toho, co v aplikaci je: odpracovaný čas (výkazy), vyúčtování a platby.
// Částky bez DPH (DPH není příjem advokáta). Vyúčtování koncepty a storno se nepočítají.
export type Entry = { case_id: string | null; minutes: number; rate: number; billed: boolean };
export type Inv = { case_id: string | null; status: string; state: string; base: number; total: number; paid: number; currency: string };
export type Profit = { hours: number; workValue: number; unbilledValue: number; billed: number; paid: number; outstanding: number; effectiveRate: number | null; realization: number | null; collection: number | null; cost: number | null; margin: number | null };

export function profitOf(entries: Entry[], invoices: Inv[], costPerHour: number | null = null): Profit {
    const minutes = entries.reduce((s, e) => s + e.minutes, 0);
    const hours = round2(minutes / 60);
    const workValue = round2(entries.reduce((s, e) => s + (e.minutes / 60) * e.rate, 0));
    const unbilledValue = round2(entries.filter((e) => !e.billed).reduce((s, e) => s + (e.minutes / 60) * e.rate, 0));
    const live = invoices.filter((i) => i.state !== 'draft' && i.state !== 'cancelled' && i.currency === 'CZK');
    const billed = round2(live.reduce((s, i) => s + i.base, 0));
    // Zaplacená část základu: podíl zaplaceného z celkové částky vyúčtování
    const paid = round2(live.reduce((s, i) => s + (i.total > 0 ? i.base * Math.min(1, i.paid / i.total) : 0), 0));
    const outstanding = round2(billed - paid);
    const cost = costPerHour !== null && costPerHour > 0 ? round2(hours * costPerHour) : null;
    return { hours, workValue, unbilledValue, billed, paid, outstanding, effectiveRate: hours > 0 ? round2(paid / hours) : null, realization: workValue > 0 ? Math.round((billed / workValue) * 100) : null, collection: billed > 0 ? Math.round((paid / billed) * 100) : null, cost, margin: cost !== null ? round2(paid - cost) : null };
}

export type Group = { id: string; name: string; profit: Profit };
// Přehled po věcech (nebo po klientech přes věci), seřazený podle odpracovaného času
export function groupProfit(by: 'case' | 'client', cases: { id: string; title: string; client_id?: string | null; client_name?: string }[], entries: Entry[], invoices: Inv[], costPerHour: number | null): Group[] {
    const keyOf = (caseId: string | null) => { const c = cases.find((x) => x.id === caseId); return by === 'case' ? c?.id ?? null : c ? c.client_id ?? (c.client_name ? `n:${c.client_name.toLowerCase()}` : null) : null; };
    const names = new Map<string, string>();
    for (const c of cases) { const k = keyOf(c.id); if (k) names.set(k, by === 'case' ? c.title : c.client_name || c.title); }
    const keys = new Set<string>();
    for (const e of entries) { const k = keyOf(e.case_id); if (k) keys.add(k); }
    for (const i of invoices) { const k = keyOf(i.case_id); if (k) keys.add(k); }
    return [...keys].map((k) => ({ id: k, name: names.get(k) ?? 'Neznámé', profit: profitOf(entries.filter((e) => keyOf(e.case_id) === k), invoices.filter((i) => keyOf(i.case_id) === k), costPerHour) })).sort((a, b) => b.profit.hours - a.profit.hours);
}

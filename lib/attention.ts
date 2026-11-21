// Upozornění pro stránku Dnes: věci blížící se rozpočtu nebo přes rozpočet a plné moci, které brzy končí nebo vypršely
import { budgetInfo } from './budget';
import { powerState, daysLeft, type Power } from './powers';

export type Alert = { id: string; tone: 'warn' | 'bad'; text: string; href: string };
export type BudgetCase = { id: string; title: string; budget_czk: number | null; budget_warn_pct: number | null };
export type WorkRow = { case_id: string | null; amount: number };

export function buildAlerts(cases: BudgetCase[], work: WorkRow[], powers: Pick<Power, 'id' | 'grantor' | 'case_id' | 'valid_from' | 'valid_to'>[], today: string): Alert[] {
    const byCase = new Map<string, number>();
    for (const w of work) if (w.case_id) byCase.set(w.case_id, (byCase.get(w.case_id) ?? 0) + w.amount);
    const out: Alert[] = [];
    for (const c of cases) {
        if (!c.budget_czk) continue;
        const info = budgetInfo({ budget: c.budget_czk, warnPct: c.budget_warn_pct ?? 80, worked: byCase.get(c.id) ?? 0, billed: 0 });
        if (info.state === 'over') out.push({ id: `b-${c.id}`, tone: 'bad', text: `Rozpočet spisu „${c.title}“ je překročený (${String(info.usedPct).replace('.', ',')} %).`, href: `/kancelar/veci/${c.id}` });
        else if (info.state === 'warn') out.push({ id: `b-${c.id}`, tone: 'warn', text: `Spis „${c.title}“ vyčerpala ${String(info.usedPct).replace('.', ',')} % rozpočtu.`, href: `/kancelar/veci/${c.id}` });
    }
    for (const p of powers) {
        const st = powerState(p, today);
        if (st === 'ending') { const d = daysLeft(p, today); out.push({ id: `p-${p.id}`, tone: 'warn', text: `Plná moc od „${p.grantor}“ končí ${d === 0 ? 'dnes' : `za ${d} ${d === 1 ? 'den' : d! < 5 ? 'dny' : 'dní'}`}.`, href: '/kancelar/plne-moci' }); }
        // Vypršené plné moci se připomínají jen krátce, ať staré záznamy nehlásí donekonečna
        else if (st === 'expired' && p.valid_to && daysLeft({ valid_to: p.valid_to }, today)! >= -14) out.push({ id: `p-${p.id}`, tone: 'bad', text: `Plná moc od „${p.grantor}“ vypršela ${p.valid_to.split('-').reverse().map(Number).join('. ')}.`, href: '/kancelar/plne-moci' });
    }
    return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1));
}

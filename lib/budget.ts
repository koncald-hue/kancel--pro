// Rozpočet věci: kolik z dohodnuté částky je vykázáno a vyúčtováno. Počítá se z výkazů (čas × sazba) a z vystavených vyúčtování.
export type BudgetInput = { budget: number | null; warnPct: number; worked: number; billed: number };
export type BudgetState = 'none' | 'ok' | 'warn' | 'over';
export type BudgetInfo = { state: BudgetState; usedPct: number; remaining: number; unbilled: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function budgetInfo({ budget, warnPct, worked, billed }: BudgetInput): BudgetInfo {
    const unbilled = Math.max(0, r2(worked - billed));
    if (!budget || budget <= 0) return { state: 'none', usedPct: 0, remaining: 0, unbilled };
    const usedPct = Math.round((worked / budget) * 1000) / 10;
    const state: BudgetState = worked > budget ? 'over' : usedPct >= warnPct ? 'warn' : 'ok';
    return { state, usedPct, remaining: r2(budget - worked), unbilled };
}

export const BUDGET_LABEL: Record<BudgetState, string> = { none: 'Bez rozpočtu', ok: 'V rozpočtu', warn: 'Blíží se rozpočet', over: 'Rozpočet překročen' };

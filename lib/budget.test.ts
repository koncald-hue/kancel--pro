import { describe, expect, it } from 'vitest';
import { budgetInfo } from './budget';

describe('budgetInfo', () => {
    it('bez rozpočtu nic nehlídá', () => expect(budgetInfo({ budget: null, warnPct: 80, worked: 5000, billed: 0 }).state).toBe('none'));
    it('počítá využití a zbývající částku', () => {
        const r = budgetInfo({ budget: 25000, warnPct: 80, worked: 6375, billed: 0 });
        expect(r).toMatchObject({ state: 'ok', usedPct: 25.5, remaining: 18625, unbilled: 6375 });
    });
    it('upozorní od zadaného procenta a pozná překročení', () => {
        expect(budgetInfo({ budget: 10000, warnPct: 80, worked: 8000, billed: 2000 }).state).toBe('warn');
        const o = budgetInfo({ budget: 10000, warnPct: 80, worked: 10500, billed: 10500 });
        expect(o.state).toBe('over'); expect(o.remaining).toBe(-500); expect(o.unbilled).toBe(0);
    });
});

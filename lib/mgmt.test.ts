import { describe, expect, it } from 'vitest';
import { byCase, byWeek, changePct, forecast, inMonth, monthEnd, shiftMonth, sumEntries, weekStart, workdaysIn } from './mgmt';

const e = (d: string, min: number, rate = 1200, billed = false, case_id: string | null = 'a') => ({ case_id, entry_date: d, minutes: min, rate, billed });

describe('přehled pro vedení', () => {
    it('měsíce', () => { expect(shiftMonth('2026-01', -1)).toBe('2025-12'); expect(shiftMonth('2026-12', 1)).toBe('2027-01'); expect(monthEnd('2026-02')).toBe('2026-02-28'); });
    it('součty a vyfakturované', () => {
        const s = sumEntries([e('2026-11-02', 60), e('2026-11-03', 30, 1000, true)]);
        expect(s.minutes).toBe(90); expect(s.amount).toBe(1700); expect(s.billedMinutes).toBe(30); expect(s.billedAmount).toBe(500);
    });
    it('pracovní dny listopadu 2026 (17. 11. svátek)', () => { expect(workdaysIn('2026-11')).toBe(20); expect(workdaysIn('2026-11', '2026-11-18')).toBe(12); });
    it('prognóza z tempa na pracovní den', () => {
        const entries = [e('2026-11-02', 480), e('2026-11-03', 480), e('2026-11-04', 480), e('2026-11-05', 480)];
        const f = forecast(entries, '2026-11-05'); // 4 pracovní dny, 32 h → 8 h/den × 20
        expect(f.elapsed).toBe(4); expect(f.total).toBe(20); expect(f.minutes).toBe(480 * 20); expect(f.reliable).toBe(true);
        expect(forecast([], '2026-11-02').reliable).toBe(false);
    });
    it('změna v procentech', () => { expect(changePct(150, 100)).toBe(50); expect(changePct(50, 100)).toBe(-50); expect(changePct(10, 0)).toBeNull(); });
    it('týdny začínají pondělím', () => { expect(weekStart('2026-11-15')).toBe('2026-11-09'); expect(weekStart('2026-11-16')).toBe('2026-11-16'); });
    it('seskupení podle týdne a věci', () => {
        const rows = [e('2026-11-09', 60), e('2026-11-13', 60, 1200, false, 'b'), e('2026-11-16', 120, 2000, false, null)];
        expect(byWeek(rows).map((w) => [w.week, w.minutes])).toEqual([['2026-11-09', 120], ['2026-11-16', 120]]);
        expect(byCase(rows)[0].caseId).toBeNull();
        expect(inMonth(rows, '2026-11').length).toBe(3);
    });
});

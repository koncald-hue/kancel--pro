import { describe, expect, it } from 'vitest';
import { dueNow, nextOn, periodLabel, periodOf } from './recurring';

describe('recurring', () => {
    it('období', () => {
        expect(periodOf('2026-11-18', 'month')).toBe('2026-11'); expect(periodOf('2026-11-18', 'quarter')).toBe('2026-Q4'); expect(periodOf('2026-02-01', 'year')).toBe('2026');
        expect(periodLabel('2026-11')).toBe('listopad 2026'); expect(periodLabel('2026-Q1')).toBe('1. čtvrtletí 2026'); expect(periodLabel('2026')).toBe('rok 2026');
    });
    it('další termín i přes konec měsíce a roku', () => {
        expect(nextOn('2026-01-31', 'month')).toBe('2026-02-28'); expect(nextOn('2028-01-31', 'month')).toBe('2028-02-29');
        expect(nextOn('2026-11-15', 'quarter')).toBe('2027-02-15'); expect(nextOn('2026-12-01', 'month')).toBe('2027-01-01'); expect(nextOn('2026-03-10', 'year')).toBe('2027-03-10');
    });
    it('na řadě: aktivní, splatné a ještě nevyfakturované období', () => {
        const base = { id: 'a', title: 'Paušál', every: 'month' as const, active: true, last_period: null };
        expect(dueNow([{ ...base, next_on: '2026-11-01' }], '2026-11-18')).toHaveLength(1);
        expect(dueNow([{ ...base, next_on: '2026-12-01' }], '2026-11-18')).toHaveLength(0);
        expect(dueNow([{ ...base, next_on: '2026-11-01', last_period: '2026-11' }], '2026-11-18')).toHaveLength(0);
        expect(dueNow([{ ...base, next_on: '2026-11-01', active: false }], '2026-11-18')).toHaveLength(0);
    });
});

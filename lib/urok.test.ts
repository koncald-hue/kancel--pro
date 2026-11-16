import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, halfYearStart, isIso, repoOn, vypocetUroku, zakonnaSazba } from './urok';

describe('repo rate history', () => {
    it('returns the rate valid on a given day, including the day of the change', () => {
        expect(repoOn('2014-01-01')).toBe(0.05);
        expect(repoOn('2017-07-01')).toBe(0.05);
        expect(repoOn('2018-07-01')).toBe(1.0);
        expect(repoOn('2019-01-01')).toBe(1.75);
        expect(repoOn('2020-01-01')).toBe(2.0);
        expect(repoOn('2020-07-01')).toBe(0.25);
        expect(repoOn('2022-01-01')).toBe(3.75);
        expect(repoOn('2024-01-01')).toBe(6.75);
        expect(repoOn('2026-11-06')).toBe(4.0);
        expect(repoOn('2012-01-01')).toBeNull();
    });
});

describe('statutory rate by half-year of the delay start', () => {
    it('adds 8 points to the rate valid on the first day of the half-year', () => {
        expect(zakonnaSazba('2025-03-31')).toMatchObject({ startProdleni: '2025-04-01', pololeti: '2025-01-01', repo: 4.0, rocni: 12 });
        expect(zakonnaSazba('2025-06-30')).toMatchObject({ pololeti: '2025-07-01', repo: 3.5, rocni: 11.5 });
        expect(zakonnaSazba('2026-12-31')?.pololeti).toBe('2027-01-01');
        expect(zakonnaSazba('2018-06-15')?.rocni).toBe(8.5);
        expect(zakonnaSazba('2018-06-30')?.rocni).toBe(9);
        expect(zakonnaSazba('2013-06-01')).toBeNull();
    });
    it('keeps the same rate for the whole delay even when the repo rate changes later', () => {
        // repo sazba se 19. 6. 2026 zvýšila na 3,75 %, prodlení z 1. pololetí ale zůstává na sazbě z 1. 1. 2026
        expect(zakonnaSazba('2026-06-20')?.rocni).toBe(11.5);
        expect(zakonnaSazba('2026-06-30')?.rocni).toBe(11.75);
    });
});

describe('interest calculation', () => {
    it('counts each day after the due date up to and including the payment day', () => {
        const r = vypocetUroku({ jistina: 100_000, splatnost: '2025-03-31', do: '2025-04-30', sazbaPct: 12 });
        expect(r.dnuCelkem).toBe(30);
        expect(r.urok).toBe(986.3);
    });
    it('lowers the principal after a partial payment from the next day', () => {
        const r = vypocetUroku({ jistina: 100_000, splatnost: '2025-01-31', do: '2025-03-02', sazbaPct: 12, splatky: [{ date: '2025-02-15', amount: 40_000 }] });
        expect(r.radky.map((x) => [x.dnu, x.jistina])).toEqual([[15, 100_000], [15, 60_000]]);
        expect(r.urok).toBe(Math.round(((100_000 * 0.12 * 15 + 60_000 * 0.12 * 15) / 365) * 100) / 100);
        expect(r.zbyvaJistina).toBe(60_000);
    });
    it('handles zero days, payments before the due date and overpayment', () => {
        expect(vypocetUroku({ jistina: 1000, splatnost: '2025-01-31', do: '2025-01-31', sazbaPct: 12 }).urok).toBe(0);
        expect(vypocetUroku({ jistina: 1000, splatnost: '2025-01-31', do: '2025-02-10', sazbaPct: 12, splatky: [{ date: '2025-01-01', amount: 500 }] }).zaplaceno).toBe(0);
        expect(vypocetUroku({ jistina: 1000, splatnost: '2025-01-31', do: '2025-02-10', sazbaPct: 12, splatky: [{ date: '2025-02-05', amount: 5000 }] }).zbyvaJistina).toBe(0);
    });
});

describe('date helpers', () => {
    it('validates and shifts ISO dates', () => {
        expect(isIso('2025-02-29')).toBe(false);
        expect(isIso('2024-02-29')).toBe(true);
        expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
        expect(daysBetween('2025-01-01', '2025-03-01')).toBe(59);
        expect(halfYearStart('2025-06-30')).toBe('2025-01-01');
    });
});

import { describe, expect, it } from 'vitest';
import { clampUprava, osobyKoeficient, sazba, vypocet } from './tarif';

describe('advokátní tarif § 7', () => {
    it('matches the tariff at every band boundary', () => {
        expect([500, 501, 1000, 1001, 5000, 5001, 10000].map(sazba)).toEqual([300, 500, 500, 1000, 1000, 1500, 1500]);
        expect(sazba(10_001)).toBe(1_540);
        expect(sazba(100_000)).toBe(5_100);
        expect(sazba(200_000)).toBe(9_100);
        expect(sazba(200_001)).toBe(9_140);
        expect(sazba(10_000_000)).toBe(48_300);
        expect(sazba(10_000_001)).toBe(48_340);
    });
});

describe('multiple clients § 12 odst. 4', () => {
    it('adds 80 %, 60 %, 40 % and 20 % for further persons', () => {
        expect([1, 2, 3, 4, 5, 6].map(osobyKoeficient)).toEqual([1, 1.8, 2.4, 2.8, 3, 3.2]);
    });
});

describe('reward calculation', () => {
    const base = { hodnota: 100_000, pocty: { '1a': 1, '1d': 2, '2h': 1 }, upravaPct: 100, osoby: 1, pausal: 450, vydaje: 0, platceDph: true, dph: 21 };
    it('sums full and half rate tasks, the flat fee per task and VAT', () => {
        const r = vypocet(base);
        expect(r.sazbaPlna).toBe(5_100);
        expect(r.ukonu).toBe(4);
        expect(r.odmenaZaklad).toBe(5_100 * 3 + 2_550);
        expect(r.pausal).toBe(1_800);
        expect(r.zaklad).toBe(17_850 + 1_800);
        expect(r.dph).toBe(4_126.5);
        expect(r.celkem).toBe(23_776.5);
    });
    it('applies reduction, several persons and no VAT for non-payers', () => {
        const r = vypocet({ ...base, upravaPct: 50, osoby: 2, platceDph: false });
        expect(r.odmena).toBe(Math.round(17_850 * 0.5 * 1.8 * 100) / 100);
        expect(r.dph).toBe(0);
        expect(r.celkem).toBe(r.zaklad);
    });
    it('limits the adjustment to 50 to 300 percent and ignores negative counts', () => {
        expect([10, 100, 900].map(clampUprava)).toEqual([50, 100, 300]);
        expect(vypocet({ ...base, pocty: { '1a': -3 } }).ukonu).toBe(0);
    });
});

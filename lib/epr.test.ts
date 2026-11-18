import { describe, expect, it } from 'vitest';
import { buildClaims, claimsCsv, eprFee, hasError, mapColumns, ordinaryFee, summary } from './epr';

const table = (rows: string[][]) => ({ headers: ['Dlužník', 'Adresa', 'IČO', 'Jistina', 'Splatnost', 'Číslo faktury'], rows });

describe('EPR: příprava', () => {
    it('poplatek podle sazebníku (položka 2 a 1)', () => {
        expect(eprFee(5000)).toBe(400); expect(eprFee(10_000)).toBe(400); expect(eprFee(10_001)).toBe(800); expect(eprFee(20_000)).toBe(800);
        expect(eprFee(50_000)).toBe(2000); expect(eprFee(20_001)).toBe(801); expect(ordinaryFee(20_000)).toBe(1000); expect(ordinaryFee(100_000)).toBe(5000);
    });
    it('přiřazení sloupců podle názvů', () => { const m = mapColumns(['Odběratel', 'Bydliště', 'RČ', 'Dlužná částka', 'Datum splatnosti', 'VS']); expect(m).toEqual({ debtor: 0, address: 1, ident: 2, amount: 3, due: 4, invoice: 5, note: -1 }); });
    it('hlavička z ukázkové tabulky se rozpozná celá', () => { expect(mapColumns(['Dlužník', 'Adresa', 'IČO nebo RČ', 'Jistina', 'Splatnost', 'Číslo faktury'])).toEqual({ debtor: 0, address: 1, ident: 2, amount: 3, due: 4, invoice: 5, note: -1 }); });
    it('kontroly: chybějící údaje, splatnost v budoucnosti, promlčení, duplicita', () => {
        const c = buildClaims(table([
            ['Novák Jan', 'Praha 1', '800101/1234', '12 000,50', '1. 3. 2026', 'F1'],
            ['', 'Brno', '', '5000', '1. 1. 2026', ''],
            ['Dvořák', '', '', 'abc', '2030-01-01', 'F3'],
            ['Starý', 'Plzeň', '123', '5000', '1. 1. 2020', 'F4'],
            ['Novák Jan', 'Praha 1', '800101/1234', '12 000,50', '1. 3. 2026', 'F1'],
        ]), '2026-11-18');
        expect(hasError(c[0])).toBe(false); expect(c[0].amount).toBe(12000.5); expect(c[0].fee).toBe(800); expect(c[0].interest).toBeGreaterThan(0); expect(c[0].interestRate).not.toBeNull();
        expect(c[1].issues.some((i) => /dlužníka/.test(i.text))).toBe(true);
        expect(hasError(c[2])).toBe(true); expect(c[2].issues.some((i) => /ještě není po splatnosti/.test(i.text))).toBe(true);
        expect(c[3].issues.some((i) => /promlčení/.test(i.text))).toBe(true);
        expect(c[4].issues.some((i) => /duplicit/.test(i.text))).toBe(true);
    });
    it('souhrn počítá jen hotové nároky; CSV má BOM a středníky', () => {
        const c = buildClaims(table([['A', 'x', '1', '1000', '1. 1. 2026', ''], ['', '', '', '', '', '']]), '2026-11-18');
        const s = summary(c); expect(s.total).toBe(1); expect(s.ready).toBe(1); expect(s.principal).toBe(1000); expect(s.fees).toBe(400);
        const csv = claimsCsv(c, '2026-11-18'); expect(csv.startsWith('﻿"Řádek";')).toBe(true); expect(csv.split('\r\n').length).toBeGreaterThan(2);
    });
});

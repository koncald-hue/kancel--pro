import { describe, expect, it } from 'vitest';
import { balanceOf, checkMove, daysOpen, isStale, movesCsv, parseAmount, reconcile, type Escrow, type Move } from './escrow';

const e: Escrow = { id: '1', title: 'Koupě bytu', purpose: '', currency: 'CZK', bank_account: '', status: 'open', opened_on: '2026-06-01', closed_on: null, client_id: null, case_id: null, note: '' };
const mv = (kind: Move['kind'], amount: number, d = '2026-06-02'): Move => ({ id: Math.random().toString(), kind, amount, moved_on: d, party: 'A', reference: '', note: '' });

describe('escrow', () => {
    it('zůstatek z příjmů, výdajů a oprav', () => {
        expect(balanceOf([mv('deposit', 1000.1), mv('payout', 400.05), mv('correction_in', 50), mv('correction_out', 0.05)])).toBe(650);
    });
    it('výdej nad zůstatek a špatné vstupy se odmítnou', () => {
        expect(checkMove(100, 'payout', 100.01, '2026-06-03', '2026-06-10')).toMatch(/převyšuje/);
        expect(checkMove(100, 'payout', 100, '2026-06-03', '2026-06-10')).toBeNull();
        expect(checkMove(0, 'deposit', 0, '2026-06-03', '2026-06-10')).toMatch(/větší než nula/);
        expect(checkMove(0, 'deposit', 1.234, '2026-06-03', '2026-06-10')).toMatch(/desetinná/);
        expect(checkMove(0, 'deposit', 5, '2026-06-11', '2026-06-10')).toMatch(/budoucnosti/);
    });
    it('částka s čárkou a mezerami', () => { expect(parseAmount('1 250,50')).toBe(1250.5); expect(Number.isNaN(parseAmount('abc'))).toBe(true); });
    it('dlouho ležící úschova', () => {
        expect(daysOpen(e, '2026-09-01')).toBe(92);
        expect(isStale(e, 10, '2026-09-01')).toBe(true);
        expect(isStale(e, 0, '2026-09-01')).toBe(false);
        expect(isStale({ ...e, status: 'closed', closed_on: '2026-06-20' }, 0, '2026-12-01')).toBe(false);
    });
    it('shoda s bankou', () => { expect(reconcile(100, 100)).toEqual({ diff: 0, ok: true }); expect(reconcile(100, 99.5).diff).toBe(-0.5); });
    it('CSV má běžící zůstatek a escapuje uvozovky', () => {
        const csv = movesCsv(e, [{ ...mv('deposit', 100, '2026-06-02'), party: 'Jan "Pepa"' }, mv('payout', 40, '2026-06-05')]);
        expect(csv).toContain('"Jan ""Pepa"""');
        expect(csv.split('\r\n').at(-1)).toContain('60,00');
    });
});

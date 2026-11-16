import { describe, expect, it } from 'vitest';
import { groupProfit, profitOf, type Entry, type Inv } from './profit';

const e = (case_id: string, minutes: number, rate: number, billed = true): Entry => ({ case_id, minutes, rate, billed });
const inv = (case_id: string, base: number, paid: number, state = 'open', total = base * 1.21): Inv => ({ case_id, status: 'issued', state, base, total, paid, currency: 'CZK' });

describe('profitability', () => {
    it('computes hours, effective rate, realization and collection from time, invoices and payments', () => {
        const p = profitOf([e('a', 120, 2000), e('a', 60, 2000, false)], [inv('a', 4000, 4840, 'paid')]);
        expect(p.hours).toBe(3);
        expect(p.workValue).toBe(6000);
        expect(p.unbilledValue).toBe(2000);
        expect(p.billed).toBe(4000);
        expect(p.paid).toBe(4000);
        expect(p.effectiveRate).toBe(1333.33);
        expect(p.realization).toBe(67);
        expect(p.collection).toBe(100);
    });
    it('counts only the paid share of a partly paid invoice and ignores drafts, storno and foreign currency', () => {
        const p = profitOf([e('a', 60, 1000)], [inv('a', 1000, 605, 'partial'), { ...inv('a', 9999, 0, 'draft'), status: 'draft' }, inv('a', 500, 0, 'cancelled'), { ...inv('a', 700, 700, 'paid'), currency: 'EUR' }]);
        expect(p.billed).toBe(1000);
        expect(p.paid).toBe(500);
        expect(p.outstanding).toBe(500);
        expect(p.collection).toBe(50);
    });
    it('shows nothing misleading without hours or invoices, and a margin only with a cost rate', () => {
        const none = profitOf([], []);
        expect(none).toMatchObject({ hours: 0, effectiveRate: null, realization: null, collection: null, margin: null });
        const m = profitOf([e('a', 120, 2000)], [inv('a', 4000, 4840, 'paid')], 800);
        expect(m.cost).toBe(1600);
        expect(m.margin).toBe(2400);
    });
    it('groups by case and by client and sorts by hours', () => {
        const cases = [{ id: 'a', title: 'Věc A', client_id: 'k1', client_name: 'Novák' }, { id: 'b', title: 'Věc B', client_id: 'k1', client_name: 'Novák' }, { id: 'c', title: 'Věc C', client_id: 'k2', client_name: 'Beta' }];
        const entries = [e('a', 60, 1000), e('b', 180, 1000), e('c', 30, 1000)];
        const byCase = groupProfit('case', cases, entries, [inv('c', 500, 605, 'paid')], null);
        expect(byCase.map((g) => g.name)).toEqual(['Věc B', 'Věc A', 'Věc C']);
        const byClient = groupProfit('client', cases, entries, [], null);
        expect(byClient.map((g) => [g.name, g.profit.hours])).toEqual([['Novák', 4], ['Beta', 0.5]]);
    });
});

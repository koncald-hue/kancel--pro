import { describe, expect, it } from 'vitest';
import { cashBook, cashBookCsv, invoiceHtml, invoicesCsv, monthly, splitVat, type OpsExpense, type OpsInvoice } from './opsBooks';

const inv = (o: Partial<OpsInvoice> = {}): OpsInvoice => ({ id: '1', number: '20260001', source: 'predplatne', issue_date: '2026-11-03', paid_on: '2026-11-03', description: 'Předplatné', total: 1210, base: 1000, vat: 210, vat_rate: 21, buyer: { name: 'AK Novák', ico: '123' }, supplier: { name: 'Provozovatel', vat_payer: true }, credit_for: null, note: '', ...o });
const exp = (o: Partial<OpsExpense> = {}): OpsExpense => ({ id: 'e', spent_on: '2026-11-10', supplier: 'Hosting s.r.o.', description: 'Server', category: 'hosting', total: 605, vat: 105, doc_no: 'FV1', ...o });

describe('opsBooks', () => {
    it('DPH shora jako v databázi', () => {
        expect(splitVat(1210, 21, true)).toEqual({ base: 1000, vat: 210 });
        expect(splitVat(999, 21, true)).toEqual({ base: 825.62, vat: 173.38 });
        expect(splitVat(999, 21, false)).toEqual({ base: 999, vat: 0 });
    });
    it('měsíční přehled: příjmy, výdaje, zisk a DPH k odvodu', () => {
        const m = monthly([inv(), inv({ issue_date: '2026-10-05', total: 1210, base: 1000, vat: 210 }), inv({ total: -1210, base: -1000, vat: -210, source: 'dobropis' })], [exp()]);
        expect(m[0]).toMatchObject({ month: '2026-11', income: 0, incomeBase: 0, expenses: 605, expensesBase: 500, profit: -500, vatDue: -105, invoices: 2 });
        expect(m[1]).toMatchObject({ month: '2026-10', incomeBase: 1000, profit: 1000, vatDue: 210 });
    });
    it('peněžní deník s průběžným zůstatkem, neuhrazené faktury vynechá', () => {
        const rows = cashBook([inv(), inv({ number: '20260002', paid_on: null })], [exp()]);
        expect(rows.map((r) => [r.doc, r.balance])).toEqual([['20260001', 1210], ['FV1', 605]]);
        expect(cashBookCsv(rows).split('\r\n')[2]).toBe('10. 11. 2026;FV1;Server – Hosting s.r.o.;;605,00;605,00');
    });
    it('kniha faktur CSV a doklad', () => {
        expect(invoicesCsv([inv({ description: 'A; B' })]).split('\r\n')[1]).toBe('20260001;3. 11. 2026;3. 11. 2026;Předplatné;AK Novák;123;;"A; B";1000,00;21;210,00;1210,00');
        expect(invoiceHtml(inv())).toContain('Faktura – daňový doklad č. 20260001');
        expect(invoiceHtml(inv({ total: -1210 }))).toContain('dobropis');
        expect(invoiceHtml(inv({ supplier: { name: 'X', vat_payer: false }, description: '<b>' }))).toContain('&lt;b&gt;');
    });
});

import { describe, expect, it } from 'vitest';
import { buildInvoiceHtml, computeTotals, lineFromPriceItem, lineFromTimeEntry, money, parseAmount, type Invoice } from './billing';

describe('billing', () => {
    it('computes totals per VAT rate and rounds to cents', () => {
        const t = computeTotals([{ qty: 2.5, unit_price: 2000, vat_rate: 21 }, { qty: 1, unit_price: 333.33, vat_rate: 21 }, { qty: 3, unit_price: 100, vat_rate: 12 }], true);
        expect(t.groups).toEqual([{ rate: 21, base: 5333.33, vat: 1120 }, { rate: 12, base: 300, vat: 36 }]);
        expect(t.base).toBe(5633.33);
        expect(t.vat).toBe(1156);
        expect(t.total).toBe(6789.33);
    });

    it('does not add VAT for a non-payer', () => {
        const t = computeTotals([{ qty: 1, unit_price: 1000, vat_rate: 21 }, { qty: 2, unit_price: 500, vat_rate: 12 }], false);
        expect(t).toMatchObject({ base: 2000, vat: 0, total: 2000, groups: [{ rate: 0, base: 2000, vat: 0 }] });
    });

    it('handles discounts (negative quantity) and empty invoices', () => {
        expect(computeTotals([{ qty: 1, unit_price: 1000, vat_rate: 21 }, { qty: -1, unit_price: 100, vat_rate: 21 }], true).total).toBe(1089);
        expect(computeTotals([], true).total).toBe(0);
    });

    it('parses amounts typed in Czech style', () => {
        expect(parseAmount('1 500,50')).toBe(1500.5);
        expect(parseAmount('2000')).toBe(2000);
        expect(parseAmount('abc')).toBeNull();
        expect(parseAmount('')).toBeNull();
    });

    it('turns time entries and price items into lines', () => {
        expect(lineFromTimeEntry({ minutes: 90, rate: 2000, description: 'Porada', entry_date: '2026-11-03' }, 21)).toEqual({ description: 'Porada (3. 11. 2026)', qty: 1.5, unit: 'hod', unit_price: 2000, vat_rate: 21 });
        expect(lineFromPriceItem({ id: 'a', name: 'Sepsání smlouvy', description: '', kind: 'sluzba', unit: 'úkon', unit_price: 5000, vat_rate: 21, active: true }, 2)).toEqual({ description: 'Sepsání smlouvy', qty: 2, unit: 'úkon', unit_price: 5000, vat_rate: 21 });
        expect(money(1234.5)).toMatch(/1\s?234,50/);
    });

    it('renders a printable document and escapes text', () => {
        const inv = { id: '1', client_id: null, case_id: null, number: '2026-001', title: '<b>x</b>', issue_date: '2026-11-15', due_date: '2026-11-29', status: 'issued', paid_at: null, note: '', currency: 'CZK', supplier_snapshot: { name: 'JUDr. Novák', bank_account: '123/0100' }, client_snapshot: { name: 'Petr Klient' }, created_at: '' } as Invoice;
        const lines = [{ description: 'Porada <script>', qty: 1, unit: 'hod', unit_price: 2000, vat_rate: 21 }];
        const html = buildInvoiceHtml(inv, lines, computeTotals(lines, false), false);
        expect(html).toContain('Faktura č. 2026-001');
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
        expect(html).toContain('není plátcem DPH');
        expect(html).toContain('variabilní symbol: <b>2026001</b>');
    });
});

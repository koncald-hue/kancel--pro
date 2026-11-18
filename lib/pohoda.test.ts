import { describe, expect, it } from 'vitest';
import { buildPohodaXml, splitAccount, type PohodaInvoice } from './pohoda';

// Jen smyšlené údaje
const inv = (over: Partial<PohodaInvoice> = {}): PohodaInvoice => ({
    id: 'i1', client_id: null, case_id: null, number: '2030001', title: 'Zastoupení ve věci', issue_date: '2030-03-01', due_date: '2030-03-15', status: 'issued', paid_at: null, note: 'Děkujeme & prosíme <o včasnou> úhradu', currency: 'CZK', created_at: '2030-03-01T00:00:00Z',
    supplier_snapshot: { name: 'JUDr. Test Vzorový', ico: '12345678', vat_payer: true, bank_account: '123456789/0100' },
    client_snapshot: { name: 'Firma "Test" s.r.o.', ico: '87654321', dic: 'CZ87654321', address: 'Hlavní 12, 301 00 Plzeň' },
    lines: [{ id: 'l1', invoice_id: 'i1', position: 0, description: 'Porada s klientem', qty: 1.5, unit: 'hod', unit_price: 2000, vat_rate: 21, price_item_id: null, time_entry_id: null }, { id: 'l2', invoice_id: 'i1', position: 1, description: 'Soudní poplatek', qty: 1, unit: 'ks', unit_price: 1000, vat_rate: 0, price_item_id: null, time_entry_id: null }],
    base: 4000, total: 4630, paid: 0, outstanding: 4630, state: 'open', daysToDue: 5, ...over,
} as unknown as PohodaInvoice);

describe('buildPohodaXml', () => {
    it('writes a dataPack with the supplier ICO, escaped text and item VAT rates', () => {
        const { xml, warnings } = buildPohodaXml([inv()], { ico: '12345678', id: 'T1' });
        expect(xml).toContain('ico="12345678"');
        expect(xml).toContain('<typ:numberRequested>2030001</typ:numberRequested>');
        expect(xml).toContain('<inv:symVar>2030001</inv:symVar>');
        expect(xml).toContain('Firma &quot;Test&quot; s.r.o.');
        expect(xml).toContain('Děkujeme &amp; prosíme &lt;o včasnou&gt; úhradu');
        expect(xml).toContain('<inv:rateVAT>high</inv:rateVAT>');
        expect(xml).toContain('<inv:rateVAT>none</inv:rateVAT>');
        expect(xml).toContain('<typ:accountNo>123456789</typ:accountNo><typ:bankCode>0100</typ:bankCode>');
        expect(xml).toContain('<typ:city>Plzeň</typ:city>');
        expect(warnings).toEqual([]);
    });
    it('uses no VAT rate for non-VAT-payers and skips drafts, cancelled and foreign-currency invoices with warnings', () => {
        const nonPayer = inv({ supplier_snapshot: { name: 'X', ico: '1', vat_payer: false } as never });
        expect(buildPohodaXml([nonPayer], { ico: '1', id: 'T' }).xml).not.toContain('<inv:rateVAT>high</inv:rateVAT>');
        const r = buildPohodaXml([inv({ status: 'draft' }), inv({ status: 'cancelled', number: '2' }), inv({ currency: 'EUR', number: '3' })], { ico: '1', id: 'T' });
        expect(r.xml).not.toContain('<dat:dataPackItem');
        expect(r.warnings.join(' ')).toContain('EUR');
    });
    it('parses bank accounts', () => {
        expect(splitAccount('19-2000145399/0800')).toEqual({ prefix: '19', no: '2000145399', bank: '0800' });
        expect(splitAccount('nesmysl')).toBeNull();
    });
});

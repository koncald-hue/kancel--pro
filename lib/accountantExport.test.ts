import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildExport, csvFile, presetPeriod, zipFiles, type FullInvoice, type PayRow } from './accountantExport';
import type { InvoiceLine } from './billing';

const line = (invoice_id: string, desc: string, qty: number, price: number, vat: number): InvoiceLine => ({ id: `${invoice_id}-${desc}`, invoice_id, position: 0, description: desc, qty, unit: 'hod', unit_price: price, vat_rate: vat, price_item_id: null, time_entry_id: null });
const sup = { name: 'JUDr. Novák', address: 'Dlouhá 12, 301 00 Plzeň', ico: '27082440', dic: 'CZ27082440', vat_payer: true, bank_account: '19-2000145399/0800' };
const inv = (id: string, number: string, issue: string, status: string, lines: InvoiceLine[], over: Record<string, unknown> = {}): FullInvoice => ({ id, user_id: 'u', client_id: null, case_id: null, number, title: 'T', issue_date: issue, due_date: '2026-12-31', status, paid_at: null, note: '', currency: 'CZK', supplier_snapshot: sup, client_snapshot: { name: 'Beta; "s.r.o."', address: 'Krátká 5, 110 00 Praha 1', ico: '25596641' }, created_at: '', base: 0, total: 0, paid: 0, outstanding: 0, state: 'open', daysToDue: 0, lines, ...over }) as unknown as FullInvoice;

const A = inv('a', '2026-001', '2026-11-03', 'paid', [line('a', 'Práce', 2, 2000, 21)]);
const B = inv('b', '2026-002', '2026-11-10', 'issued', [line('b', 'Výdaj', 1, 450, 12), line('b', 'Práce', 1, 1000, 21)]);
const C = inv('c', '2026-003', '2026-11-12', 'cancelled', [line('c', 'Storno', 1, 5000, 21)]);
const D = inv('d', '2026-004', '2026-10-30', 'issued', [line('d', 'Říjen', 1, 100, 21)]);
const E = inv('e', '2026-005', '2026-11-15', 'draft', [line('e', 'Koncept', 1, 100, 21)], { number: null });
const pays: PayRow[] = [{ id: 'p1', invoice_id: 'a', amount: 4840, paid_on: '2026-11-08', note: 'Banka', invoice_number: '2026-001', counterparty: 'Beta' }, { id: 'p2', invoice_id: 'd', amount: 121, paid_on: '2026-11-02', note: '', invoice_number: '2026-004' }];
const input = { invoices: [A, B, C, D, E], payments: pays, from: '2026-11-01', to: '2026-11-30', today: '2026-12-01' };

describe('accountant export', () => {
    const r = buildExport(input, { isdoc: true });
    it('includes only issued invoices of the period and sums VAT per rate without cancelled ones', () => {
        expect(r.summary.invoices).toBe(2);
        expect(r.summary.cancelled).toBe(1);
        const rate = (n: number) => r.summary.byRate.find((x) => x.rate === n);
        expect(rate(21)).toEqual({ rate: 21, base: 5000, vat: 1050 });
        expect(rate(12)).toEqual({ rate: 12, base: 450, vat: 54 });
        expect(r.summary.total).toBe(6554);
    });
    it('exports payments of the period only, and receivables as of the end of the period', () => {
        expect(r.summary.payments).toBe(2);
        expect(r.summary.paid).toBe(4961);
        const rec = r.files.find((f) => f.name === 'pohledavky.csv')!.content;
        expect(rec).toContain('2026-002');
        expect(rec).not.toContain('2026-004');
        expect(rec).not.toContain('2026-001;');
        expect(r.summary.receivables).toBe(round(1000 * 1.21 + 450 * 1.12));
    });
    it('writes Czech Excel CSV with BOM, semicolons, decimal commas and escaped quotes', () => {
        const csv = r.files.find((f) => f.name === 'vydane-faktury.csv')!.content;
        expect(csv.charCodeAt(0)).toBe(0xfeff);
        expect(csv).toContain('"Beta; ""s.r.o."""');
        expect(csv).toContain('3. 11. 2026');
        expect(csv).toContain('4840');
        expect(csvFile('x.csv', ['A'], [[1234.5]]).content).toContain('1234,5');
    });
    it('marks cancelled invoices with zero amounts and warns about drafts and the EUR invoices', () => {
        const csv = r.files.find((f) => f.name === 'vydane-faktury.csv')!.content;
        expect(csv).toMatch(/2026-003;[^\n]*storno/);
        expect(r.warnings.join(' ')).toContain('konceptů');
        const eur = buildExport({ ...input, invoices: [inv('x', '2026-009', '2026-11-05', 'issued', [line('x', 'EUR', 1, 100, 0)], { currency: 'EUR' })] }, { isdoc: true });
        expect(eur.warnings.join(' ')).toContain('EUR');
        expect(eur.files.some((f) => f.name.startsWith('isdoc/'))).toBe(false);
    });
    it('adds an ISDOC file per live CZK invoice and a README with checksums', () => {
        expect(r.files.filter((f) => f.name.startsWith('isdoc/')).map((f) => f.name).sort()).toEqual(['isdoc/2026-001.isdoc', 'isdoc/2026-002.isdoc']);
        expect(r.files.find((f) => f.name === 'README.txt')!.content).toContain('Kontrolní součty: 2 faktur');
        expect(buildExport(input, { isdoc: false }).files.some((f) => f.name.startsWith('isdoc/'))).toBe(false);
    });
    it('packs everything into a ZIP', async () => {
        const zip = await JSZip.loadAsync(await new Promise<ArrayBuffer>((res) => { const f = new FileReader(); zipFiles(r.files).then((b) => { f.onload = () => res(f.result as ArrayBuffer); f.readAsArrayBuffer(b); }); }));
        expect(Object.keys(zip.files)).toContain('README.txt');
        expect(Object.keys(zip.files)).toContain('isdoc/2026-001.isdoc');
    });
});
const round = (n: number) => Math.round(n * 100) / 100;

describe('period presets', () => {
    it('computes month, quarter and year ranges, also across the year end', () => {
        expect(presetPeriod('month', '2026-11-16')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
        expect(presetPeriod('lastmonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
        expect(presetPeriod('quarter', '2026-11-16')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
        expect(presetPeriod('lastquarter', '2026-02-10')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
        expect(presetPeriod('lastmonth', '2026-03-05')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
        expect(presetPeriod('lastyear', '2026-11-16')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    });
});

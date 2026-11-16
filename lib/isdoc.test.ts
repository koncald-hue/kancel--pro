import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIsdoc, splitAddress } from './isdoc';
import type { Invoice, InvoiceLine } from './billing';

const base: Invoice = { id: 'i1', user_id: 'u', client_id: null, case_id: null, number: '2026-001', title: 'Věc', issue_date: '2026-11-09', due_date: '2026-11-23', status: 'issued', paid_at: null, note: 'Děkujeme', currency: 'CZK', supplier_snapshot: { name: 'JUDr. Jan Novák', firm: 'AK Novák', address: 'Dlouhá 12, 301 00 Plzeň', ico: '27082440', dic: 'CZ27082440', vat_payer: true, bank_account: '19-2000145399/0800' }, client_snapshot: { name: 'Beta s.r.o.', address: 'Krátká 5/3, 110 00 Praha 1', ico: '25596641', dic: 'CZ25596641' }, created_at: '' } as unknown as Invoice;
const lines: InvoiceLine[] = [
    { id: 'l1', invoice_id: 'i1', position: 0, description: 'Porada & rozbor <A>', qty: 1.5, unit: 'hod', unit_price: 2000, vat_rate: 21, price_item_id: null, time_entry_id: null },
    { id: 'l2', invoice_id: 'i1', position: 1, description: 'Hotové výdaje', qty: 1, unit: 'ks', unit_price: 450, vat_rate: 12, price_item_id: null, time_entry_id: null },
];

const XSD = join(__dirname, 'testdata', 'isdoc-invoice-6.0.2.xsd');
const validate = (xml: string) => { const f = join(mkdtempSync(join(tmpdir(), 'isdoc-')), 'f.xml'); writeFileSync(f, xml); try { execFileSync('xmllint', ['--noout', '--schema', XSD, f], { stdio: 'pipe' }); return ''; } catch (e) { return String((e as { stderr?: Buffer }).stderr ?? e); } };
let hasXmllint = true; try { execFileSync('xmllint', ['--version'], { stdio: 'pipe' }); } catch { hasXmllint = false; }

describe('address splitting', () => {
    it('splits street, number, zip and city', () => {
        expect(splitAddress('Dlouhá 12, 301 00 Plzeň')).toEqual({ street: 'Dlouhá', number: '12', city: 'Plzeň', zip: '30100', parsed: true });
        expect(splitAddress('Krátká 5/3, 110 00 Praha 1')).toMatchObject({ street: 'Krátká', number: '5/3', city: 'Praha 1', zip: '11000' });
        expect(splitAddress('někde v Česku')).toMatchObject({ parsed: false, street: 'někde v Česku' });
    });
});

describe('ISDOC export', () => {
    it('skips drafts and foreign currency', () => {
        expect(buildIsdoc({ ...base, number: null }, lines, 'u')).toBeNull();
        expect(buildIsdoc({ ...base, currency: 'EUR' }, lines, 'u')).toBeNull();
    });
    it('escapes text and states VAT per rate', () => {
        const r = buildIsdoc(base, lines, '6e1f8a0c-1c0e-4b8e-9a54-2b0d3d9e8f11');
        expect(r?.xml).toContain('Porada &amp; rozbor &lt;A&gt;');
        expect(r?.xml).toContain('<PayableAmount>4134.00</PayableAmount>');
        expect(r?.xml).toContain('<VariableSymbol>2026001</VariableSymbol>');
        expect(r?.warnings).toEqual([]);
    });
    it.skipIf(!hasXmllint)('validates against the official ISDOC 6.0.2 schema (VAT payer)', () => {
        expect(validate(buildIsdoc(base, lines, '6e1f8a0c-1c0e-4b8e-9a54-2b0d3d9e8f11')!.xml)).toMatch(/validates|^$/);
    });
    it.skipIf(!hasXmllint)('validates for a non-payer and with an unparsable address', () => {
        const np = { ...base, supplier_snapshot: { ...base.supplier_snapshot, vat_payer: false, address: 'neznámá adresa' } } as unknown as Invoice;
        const r = buildIsdoc(np, lines.slice(0, 1), '6e1f8a0c-1c0e-4b8e-9a54-2b0d3d9e8f11')!;
        expect(r.warnings.length).toBe(1);
        expect(validate(r.xml)).toMatch(/validates|^$/);
    });
});

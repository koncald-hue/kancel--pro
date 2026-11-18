import { describe, expect, it } from 'vitest';
import { buildMoneyS3Xml, type MoneyInvoice } from './moneyS3';

const inv = (over: Partial<MoneyInvoice> = {}): MoneyInvoice => ({
    id: 'i1', client_id: null, case_id: null, number: '2026-007', title: 'Právní služby – říjen', issue_date: '2026-11-02', due_date: '2026-11-16', status: 'issued', paid_at: null, note: '', currency: 'CZK',
    supplier_snapshot: { vat_payer: true }, client_snapshot: { name: 'ACME & syn s.r.o.', address: 'Hlavní 12, 301 00 Plzeň', ico: '12345678', dic: 'CZ12345678' }, created_at: '',
    base: 0, total: 0, paid: 0, outstanding: 0, state: 'open', daysToDue: 0,
    lines: [{ id: 'l1', invoice_id: 'i1', position: 0, description: 'Porada <2 h>', qty: 2, unit: 'h', unit_price: 2000, vat_rate: 21, price_item_id: null, time_entry_id: null }, { id: 'l2', invoice_id: 'i1', position: 1, description: 'Kniha', qty: 1, unit: 'ks', unit_price: 100, vat_rate: 12, price_item_id: null, time_entry_id: null }],
    ...over,
} as MoneyInvoice);

describe('moneyS3', () => {
    it('vydaná faktura: hlavička, souhrn DPH po sazbách, odběratel a položky', () => {
        const { xml, count, warnings } = buildMoneyS3Xml([inv()], { ico: '87654321' });
        expect(count).toBe(1); expect(warnings).toEqual([]);
        expect(xml).toContain('<MoneyData ICAgendy="87654321" JazykVerze="CZ"><SeznamFaktVyd><FaktVyd><Doklad>2026-007</Doklad>');
        expect(xml).toContain('<Vystaveno>2026-11-02</Vystaveno><DatUcPr>2026-11-02</DatUcPr><PlnenoDPH>2026-11-02</PlnenoDPH><Splatno>2026-11-16</Splatno><VarSymbol>2026007</VarSymbol><Druh>N</Druh>');
        expect(xml).toContain('<SouhrnDPH><Zaklad0>0.00</Zaklad0><Zaklad5>100.00</Zaklad5><Zaklad22>4000.00</Zaklad22><DPH5>12.00</DPH5><DPH22>840.00</DPH22></SouhrnDPH><Celkem>4952.00</Celkem>');
        expect(xml).toContain('<ObchNazev>ACME &amp; syn s.r.o.</ObchNazev><ObchAdresa><Ulice>Hlavní 12</Ulice><Misto>Plzeň</Misto><PSC>30100</PSC>');
        expect(xml).toContain('<ICO>12345678</ICO><DIC>CZ12345678</DIC>');
        expect(xml).toContain('<Polozka><Popis>Porada &lt;2 h&gt;</Popis><PocetMJ>2</PocetMJ><SazbaDPH>21</SazbaDPH><Cena>2000.00</Cena><CenaTyp>0</CenaTyp><Poradi>1</Poradi></Polozka>');
    });
    it('výstup je platné XML (bez chyby parseru)', () => {
        const { xml } = buildMoneyS3Xml([inv(), inv({ number: 'Z2026-001', kind: 'zaloha' })], { ico: '1' });
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.getElementsByTagName('FaktVyd')).toHaveLength(2);
    });
    it('neplátce DPH: vše v nulové sazbě', () => {
        const { xml } = buildMoneyS3Xml([inv({ supplier_snapshot: { vat_payer: false } })], { ico: '1' });
        expect(xml).toContain('<Zaklad0>4100.00</Zaklad0><Zaklad5>0.00</Zaklad5><Zaklad22>0.00</Zaklad22>'); expect(xml).toContain('<Celkem>4100.00</Celkem>');
    });
    it('zálohová faktura má druh F a bez data zdanitelného plnění', () => {
        const { xml } = buildMoneyS3Xml([inv({ kind: 'zaloha', number: 'Z2026-001' })], { ico: '1' });
        expect(xml).toContain('<Druh>F</Druh>'); expect(xml).not.toContain('<PlnenoDPH>');
    });
    it('koncepty, storna a cizí měna se nevyvezou, s varováním', () => {
        const r = buildMoneyS3Xml([inv({ status: 'draft' }), inv({ status: 'cancelled' }), inv({ currency: 'EUR' })], { ico: '1' });
        expect(r.count).toBe(0); expect(r.warnings.join(' ')).toMatch(/EUR/); expect(r.warnings.join(' ')).toMatch(/není žádná/);
    });
});

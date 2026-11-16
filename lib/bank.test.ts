import { describe, expect, it } from 'vitest';
import { decide, normalizeFio, parseAmount, parseBankCsv, parseDateCell, planBatch, type BankTx, type OpenInvoice } from './bank';

const FIO = { accountStatement: { transactionList: { transaction: [
    { column22: { value: 1150808074, name: 'ID pohybu', id: 22 }, column0: { value: '2026-11-09+0100', id: 0 }, column1: { value: 12100, id: 1 }, column14: { value: 'CZK', id: 14 }, column2: { value: '2600044444', id: 2 }, column10: { value: 'Jan Novák', id: 10 }, column3: { value: '2010', id: 3 }, column5: { value: '2026001', id: 5 }, column16: { value: 'Faktura 2026-001', id: 16 }, column8: { value: 'Příjem převodem', id: 8 } },
    { column22: { value: 1150808075, id: 22 }, column0: { value: 1342476000000, id: 0 }, column1: { value: -15, id: 1 }, column14: { value: 'CZK', id: 14 }, column10: null },
    { column22: null, column0: { value: '2026-11-10+0100' }, column1: { value: 5 } },
] } } };

describe('Fio normalisation', () => {
    it('maps columns and drops rows without id, date or amount', () => {
        const t = normalizeFio(FIO);
        expect(t).toHaveLength(2);
        expect(t[0]).toMatchObject({ txid: 'fio:1150808074', date: '2026-11-09', amount: 12100, currency: 'CZK', vs: '2026001', counterparty: 'Jan Novák', account: '2600044444', bankCode: '2010', message: 'Faktura 2026-001' });
        expect(t[1].date).toBe('2012-07-17');
        expect(normalizeFio({})).toEqual([]);
    });
});

describe('CSV import', () => {
    const csv = '﻿"Datum";"Objem";"Měna";"Protiúčet";"Název protiúčtu";"VS";"Zpráva pro příjemce";"ID pohybu"\n"09.11.2026";"12 100,00";"CZK";"2600044444/2010";"Jan Novák";"2026001";"Faktura 2026-001";"111"\n"10.11.2026";"-250,50";"CZK";"";"Poplatek";"";"";"112"\n"neplatné";"5";"CZK";"";"";"";"";"113"';
    it('detects Czech headers, parses dates and amounts and reports skipped rows', () => {
        const r = parseBankCsv(csv, 'acc1');
        expect(r.txs).toHaveLength(2);
        expect(r.txs[0]).toMatchObject({ txid: 'acc1:111', date: '2026-11-09', amount: 12100, vs: '2026001', counterparty: 'Jan Novák' });
        expect(r.txs[1].amount).toBe(-250.5);
        expect(r.skipped).toBe(1);
        expect(r.missing).toEqual([]);
    });
    it('gives identical rows without an id distinct ids and reports missing columns', () => {
        const r = parseBankCsv('Datum;Částka;VS\n1.11.2026;100;5\n1.11.2026;100;5', 'a');
        expect(new Set(r.txs.map((t) => t.txid)).size).toBe(2);
        expect(parseBankCsv('foo;bar\n1;2').missing).toEqual(['datum', 'částka']);
    });
    it('parses amounts and dates in common notations', () => {
        expect(['1 234,50', '1234.50', '-15,00', '+1.000,00', '1,234.50', 'abc'].map(parseAmount)).toEqual([1234.5, 1234.5, -15, 1000, 1234.5, null]);
        expect(parseDateCell('9. 11. 2026 10:15')).toBe('2026-11-09');
        expect(parseDateCell('2026-11-09T10:00')).toBe('2026-11-09');
        expect(parseDateCell('31.2.2026')).toBeNull();
    });
});

const inv = (id: string, number: string, outstanding: number, client = 'Jan Novák', currency = 'CZK'): OpenInvoice => ({ id, number, vs: number.replace(/\D/g, ''), outstanding, currency, client, due: null });
const tx = (over: Partial<BankTx>): BankTx => ({ txid: 'x', date: '2026-11-09', amount: 1000, currency: 'CZK', vs: '', ks: '', ss: '', counterparty: '', account: '', bankCode: '', message: '', type: '', ...over });

describe('automatic pairing', () => {
    const invoices = [inv('a', '2026-001', 12100), inv('b', '2026-002', 5000, 'Firma Beta s.r.o.'), inv('c', '2026-003', 5000, 'Gama a.s.')];
    it('pairs automatically by variable symbol, also with leading zeros, for a full or partial payment', () => {
        expect(decide(tx({ amount: 12100, vs: '2026001' }), invoices)).toMatchObject({ kind: 'auto', invoiceId: 'a', apply: 12100, confidence: 'vs' });
        expect(decide(tx({ amount: 12100, vs: '0002026001' }), invoices).invoiceId).toBe('a');
        const part = decide(tx({ amount: 2000, vs: '2026001' }), invoices);
        expect(part).toMatchObject({ kind: 'auto', apply: 2000 });
        expect(part.reason).toContain('částečná');
    });
    it('does not auto-apply an overpayment or a different currency', () => {
        expect(decide(tx({ amount: 13000, vs: '2026001' }), invoices)).toMatchObject({ kind: 'overpay', invoiceId: 'a', apply: 12100 });
        expect(decide(tx({ amount: 12100, vs: '2026001', currency: 'EUR' }), invoices).kind).toBe('suggest');
    });
    it('also auto-pairs by invoice number in the message or by exact amount plus counterparty name, but only suggests on amount alone', () => {
        expect(decide(tx({ amount: 5000, message: 'za fakturu 2026-002 díky' }), invoices)).toMatchObject({ kind: 'auto', invoiceId: 'b', confidence: 'cislo' });
        expect(decide(tx({ amount: 5000, counterparty: 'Beta s.r.o.' }), invoices)).toMatchObject({ kind: 'auto', invoiceId: 'b', confidence: 'castka' });
    });
    it('does not guess when two invoices have the same amount or the symbol is unknown', () => {
        expect(decide(tx({ amount: 5000 }), invoices).kind).toBe('none');
        expect(decide(tx({ amount: 5000, vs: '999' }), invoices).kind).toBe('none');
        expect(decide(tx({ amount: -100 }), invoices).kind).toBe('none');
        expect(decide(tx({ amount: 100, vs: '2026001' }), [inv('a', '2026-001', 0)]).kind).toBe('none');
    });
    it('lowers the remaining amount between payments of one batch', () => {
        const plan = planBatch([tx({ txid: '2', date: '2026-11-10', amount: 7000, vs: '2026001' }), tx({ txid: '1', date: '2026-11-09', amount: 5100, vs: '2026001' })], invoices);
        expect(plan.map((p) => [p.tx.txid, p.d.kind, p.d.apply])).toEqual([['1', 'auto', 5100], ['2', 'auto', 7000]]);
        const over = planBatch([tx({ txid: '1', date: '2026-11-09', amount: 12100, vs: '2026001' }), tx({ txid: '2', date: '2026-11-10', amount: 100, vs: '2026001' })], invoices);
        expect(over[1].d.kind).toBe('none');
    });
});

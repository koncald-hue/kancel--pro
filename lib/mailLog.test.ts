import { describe, expect, it } from 'vitest';
import { deliveryState, findTheirRef, logCsv, refNo, type MailLogRow } from './mailLog';

const row = (o: Partial<MailLogRow> = {}): MailLogRow => ({ id: '1', user_id: 'u', case_id: 'c', year: 2026, seq: 7, direction: 'out', channel: 'listinna', event_on: '2026-11-18', counterparty: 'Okresní soud Plzeň', their_ref: '12 C 5/2026', subject: 'Odvolání; doplnění', attachments: 2, delivered_on: null, delivery_note: '', source_ref: null, note: '', created_at: '', ...o });

describe('mailLog', () => {
    it('číslo jednací', () => { expect(refNo({ year: 2026, seq: 7 })).toBe('2026/0007'); expect(refNo({ year: 2026, seq: 12345 })).toBe('2026/12345'); });
    it('stav doručení', () => {
        expect(deliveryState(row())).toBe('ceka'); expect(deliveryState(row({ delivered_on: '2026-11-20' }))).toBe('doruceno');
        expect(deliveryState(row({ direction: 'in' }))).toBe('n/a'); expect(deliveryState(row({ channel: 'osobne' }))).toBe('n/a'); expect(deliveryState(row({ channel: 'email' }))).toBe('n/a'); expect(deliveryState(row({ channel: 'datovka' }))).toBe('ceka');
    });
    it('CSV s escapováním', () => {
        const csv = logCsv([row()], () => 'Novák');
        expect(csv.split('\r\n')[1]).toBe('2026/0007;18. 11. 2026;Odesláno;Listinná pošta;Okresní soud Plzeň;12 C 5/2026;"Odvolání; doplnění";2;Novák;;;');
    });
    it('cizí číslo jednací z textu', () => {
        expect(findTheirRef('Předmět: Výzva, č. j. MMP/1234/2026 ze dne')).toBe('MMP/1234/2026');
        expect(findTheirRef('sp. zn. 12 C 5/2026')).toBe('12 C 5/2026');
        expect(findTheirRef('nic')).toBe('');
    });
});

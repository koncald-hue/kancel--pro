import { describe, expect, it } from 'vitest';
import { redact } from './redact';

describe('redact', () => {
    it('masks identifiers with a fixed shape', () => {
        const r = redact('RČ 800101/1234, účet 19-2000145399/0800, IBAN CZ65 0800 0000 1920 0014 5399, e-mail jan.vzorovy@example.cz, tel. +420 777 123 456 a 602 111 222.');
        expect(r.text).toContain('[RODNÉ ČÍSLO]'); expect(r.text).toContain('[ÚČET]'); expect(r.text).toContain('[IBAN]'); expect(r.text).toContain('[E-MAIL]');
        expect(r.text.match(/\[TELEFON\]/g)).toHaveLength(2);
        expect(r.text).not.toMatch(/800101|2000145399|jan\.vzorovy|777 123/);
        expect(r.count).toBeGreaterThanOrEqual(6);
    });
    it('keeps file numbers, dates, amounts and ordinary text', () => {
        const t = 'Ve spisu sp. zn. 10 C 123/2024 dne 15. 3. 2030 žalobce požaduje 125 000 Kč.';
        expect(redact(t)).toEqual({ text: t, count: 0 });
    });
    it('masks identity document numbers', () => { expect(redact('OP č. 123456789 platné do 2030').text).toContain('[DOKLAD]'); });
});

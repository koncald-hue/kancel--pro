import { describe, expect, it } from 'vitest';
import { formatIban, ibanValid, spayd, toIban } from './qrPayment';

describe('Czech account number to IBAN', () => {
    it('converts the well-known example from the Czech Banking Association', () => {
        expect(toIban('19-2000145399/0800')).toBe('CZ6508000000192000145399');
        expect(formatIban('CZ6508000000192000145399')).toBe('CZ65 0800 0000 1920 0014 5399');
    });
    it('pads the account number and prefix and handles accounts without a prefix', () => {
        expect(toIban('123456789/0100')).toMatch(/^CZ\d{2}01000000000123456789$/);
        expect(ibanValid(toIban('2000145399/0800') ?? '')).toBe(true);
        expect(toIban('000019-2000145399/0800')).toBe('CZ6508000000192000145399');
    });
    it('accepts a valid IBAN, rejects invalid input', () => {
        expect(toIban('CZ65 0800 0000 1920 0014 5399')).toBe('CZ6508000000192000145399');
        expect(toIban('CZ66 0800 0000 1920 0014 5399')).toBeNull();
        expect(toIban('123456')).toBeNull();
        expect(toIban('abc/0100')).toBeNull();
        expect(ibanValid('GB82WEST12345698765432')).toBe(true);
    });
});

describe('SPAYD payload', () => {
    const base = { iban: '19-2000145399/0800', amount: 12345.5, currency: 'CZK' as const };
    it('builds a valid payload with variable symbol, message and due date', () => {
        expect(spayd({ ...base, vs: '2026-001', message: 'Faktura 2026-001', due: '2026-12-01' })).toBe('SPD*1.0*ACC:CZ6508000000192000145399*AM:12345.50*CC:CZK*X-VS:2026001*MSG:Faktura 2026-001*DT:20261201');
    });
    it('strips diacritics and the asterisk from text fields and limits their length', () => {
        const p = spayd({ ...base, message: 'Právní služby * říjen ' + 'x'.repeat(80), name: 'Advokát Žlutý' }) ?? '';
        expect(p).toContain('MSG:Pravni sluzby');
        expect(p.split('*').filter((s) => s.startsWith('MSG:'))[0].length).toBeLessThanOrEqual(64);
        expect(p).toContain('RN:Advokat Zluty');
    });
    it('refuses a missing amount or an invalid account', () => {
        expect(spayd({ ...base, amount: 0 })).toBeNull();
        expect(spayd({ ...base, iban: 'nesmysl' })).toBeNull();
    });
});

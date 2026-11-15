import { describe, expect, it } from 'vitest';
import { generateToken, initials, isAllowedUpload, isLinkActive, isValidIntakeCode, isValidToken, validateIdentity } from './portal';

describe('portal helpers', () => {
    it('generates unique url-safe tokens', () => {
        const a = generateToken();
        expect(isValidToken(a)).toBe(true);
        expect(generateToken()).not.toBe(a);
        expect(isValidToken('short')).toBe(false);
    });

    it('checks link validity by revocation and expiry', () => {
        const now = new Date('2026-11-15T10:00:00Z');
        expect(isLinkActive({ revoked: false, expires_at: null }, now)).toBe(true);
        expect(isLinkActive({ revoked: true, expires_at: null }, now)).toBe(false);
        expect(isLinkActive({ revoked: false, expires_at: '2026-11-01T00:00:00Z' }, now)).toBe(false);
        expect(isLinkActive({ revoked: false, expires_at: '2027-01-01T00:00:00Z' }, now)).toBe(true);
    });

    it('only allows safe documents and images up to 15 MB', () => {
        expect(isAllowedUpload('smlouva.pdf', 1000)).toBeNull();
        expect(isAllowedUpload('foto.HEIC', 1000)).toBeNull();
        expect(isAllowedUpload('virus.exe', 1000)).not.toBeNull();
        expect(isAllowedUpload('stranka.html', 1000)).not.toBeNull();
        expect(isAllowedUpload('velky.pdf', 20 * 1024 * 1024)).not.toBeNull();
        expect(isValidIntakeCode('kancelar-novak')).toBe(true);
        expect(isValidIntakeCode('A B')).toBe(false);
    });

    it('validates the client identity form', () => {
        const ok = { name: 'Jan Novák', email: 'jan@example.com', phone: '', address: '', consent: true };
        expect(validateIdentity(ok)).toBeNull();
        expect(validateIdentity({ ...ok, name: 'J' })).not.toBeNull();
        expect(validateIdentity({ ...ok, email: '', phone: '' })).not.toBeNull();
        expect(validateIdentity({ ...ok, email: 'neplatny' })).not.toBeNull();
        expect(validateIdentity({ ...ok, consent: false })).not.toBeNull();
        expect(initials('jan novák')).toBe('JN');
    });
});

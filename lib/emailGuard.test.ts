import { describe, expect, it } from 'vitest';
import { isBlockedRelayEmail } from './emailGuard';
import { buildAccountDeleted } from './accountMail';

describe('isBlockedRelayEmail', () => {
    it('blokuje skrytý e-mail od Applu bez ohledu na velikost písmen a mezery', () => {
        expect(isBlockedRelayEmail('abc123@privaterelay.appleid.com')).toBe(true);
        expect(isBlockedRelayEmail('  Abc@PrivateRelay.AppleID.com ')).toBe(true);
    });
    it('běžné adresy včetně icloud propustí', () => {
        expect(isBlockedRelayEmail('jan@icloud.com')).toBe(false);
        expect(isBlockedRelayEmail('jan@advokat.cz')).toBe(false);
    });
});

describe('buildAccountDeleted', () => {
    it('říká, že účet byl smazán a nelze obnovit', () => {
        const m = buildAccountDeleted('https://x.cz/');
        expect(m.subject).toContain('smazán');
        expect(m.text).toContain('nelze je obnovit');
        expect(m.text).toContain('https://x.cz');
    });
});

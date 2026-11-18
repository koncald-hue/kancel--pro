import { describe, expect, it } from 'vitest';
import { base32Decode, totp } from './totp';
import { jwtAal, mfaBlocked } from './serverMfa';

// Testovací vektory z RFC 6238 (klíč „12345678901234567890“, 8 číslic, SHA-1)
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
describe('totp', () => {
    it('matches RFC 6238 vectors', () => {
        expect(base32Decode(SECRET).toString()).toBe('12345678901234567890');
        expect(totp(SECRET, 59_000, 8)).toBe('94287082');
        expect(totp(SECRET, 1_111_111_109_000, 8)).toBe('07081804');
        expect(totp(SECRET, 20_000_000_000_000, 8)).toBe('65353130');
    });
});

const tok = (aal?: string) => `x.${Buffer.from(JSON.stringify(aal ? { aal } : {})).toString('base64url')}.y`;
describe('mfaBlocked', () => {
    const enrolled = { factors: [{ id: '1', factor_type: 'totp', status: 'verified' }] } as never;
    it('blocks aal1 tokens of accounts with a verified factor', () => { expect(mfaBlocked(enrolled, tok('aal1'))).toBe(true); expect(mfaBlocked(enrolled, tok())).toBe(true); });
    it('allows aal2 tokens', () => { expect(mfaBlocked(enrolled, tok('aal2'))).toBe(false); });
    it('does not block accounts without a verified factor', () => {
        expect(mfaBlocked({ factors: [] } as never, tok('aal1'))).toBe(false);
        expect(mfaBlocked({ factors: [{ id: '1', factor_type: 'totp', status: 'unverified' }] } as never, tok('aal1'))).toBe(false);
        expect(mfaBlocked({} as never, tok('aal1'))).toBe(false);
    });
    it('treats garbage tokens as aal1', () => { expect(jwtAal('nonsense')).toBe('aal1'); });
});

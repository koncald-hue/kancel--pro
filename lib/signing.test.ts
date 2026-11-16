import { describe, expect, it } from 'vitest';
import { canonicalJson, defaultLevel, generateOtp, isSha256, maskPhone, normalizePhone, otpHash, sealEvidence, sha256Hex, verifySeal, type Evidence } from './signing';

const ev: Evidence = { v: 1, requestId: 'r1', title: 'Smlouva', level: 'advanced', docSha256: 'a'.repeat(64), signer: { name: 'Jan Novák', phoneMasked: '+42••••789' }, identity: { method: 'bankid', given: 'Jan', family: 'Novák', birthdate: '1985-03-02' }, otp: { channel: 'sms', verifiedAt: '2026-11-16T10:00:00Z' }, signedAt: '2026-11-16T10:00:01Z', ip: '1.2.3.4', userAgent: 'x', consent: 'c' };

describe('signing', () => {
    it('hashes with SHA-256 (known vector)', async () => {
        expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect(isSha256('a'.repeat(64))).toBe(true);
        expect(isSha256('xyz')).toBe(false);
    });
    it('writes canonical JSON independent of key order', () => {
        expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: undefined }] } })).toBe('{"a":{"c":[3,{"z":1}],"d":2},"b":1}');
    });
    it('seals the evidence and detects any change', async () => {
        const seal = await sealEvidence('s3cret', ev);
        expect(await verifySeal('s3cret', ev, seal)).toBe(true);
        expect(await verifySeal('s3cret', { ...ev, docSha256: 'b'.repeat(64) }, seal)).toBe(false);
        expect(await verifySeal('other', ev, seal)).toBe(false);
        expect(await sealEvidence('s3cret', JSON.parse(JSON.stringify(ev)))).toBe(seal);
    });
    it('generates 6 digit codes bound to the request', async () => {
        for (let i = 0; i < 20; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
        expect(await otpHash('k', 'r1', '123456')).not.toBe(await otpHash('k', 'r2', '123456'));
        expect(await otpHash('k', 'r1', '123456')).toBe(await otpHash('k', 'r1', '123456'));
    });
    it('normalizes Czech phone numbers and masks them', () => {
        expect(normalizePhone('777 123 456')).toBe('+420777123456');
        expect(normalizePhone('+420 777 123 456')).toBe('+420777123456');
        expect(normalizePhone('00421905123456')).toBe('+421905123456');
        expect(normalizePhone('12345')).toBeNull();
        expect(maskPhone('+420777123456')).not.toContain('777123');
        expect(maskPhone('+420777123456').endsWith('456')).toBe(true);
    });
    it('recommends the qualified level for court documents and powers of attorney', () => {
        expect(defaultLevel('smlouva')).toBe('advanced');
        expect(defaultLevel('plna_moc')).toBe('qualified');
        expect(defaultLevel('podani')).toBe('qualified');
    });
});

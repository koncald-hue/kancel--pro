// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isPrivateIp, resolvePublic, validateCreds } from './mailServer';

describe('mail bridge safety', () => {
    it('recognises private, loopback and link-local addresses', () => {
        for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1', '172.31.255.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(isPrivateIp(ip), ip).toBe(true);
        for (const ip of ['8.8.8.8', '172.32.0.1', '77.75.74.172', '2a02:598:2::1']) expect(isPrivateIp(ip), ip).toBe(false);
    });
    it('refuses internal addresses and bad host names before connecting', async () => {
        await expect(resolvePublic('127.0.0.1')).rejects.toThrow();
        await expect(resolvePublic('localhost')).rejects.toThrow();
        await expect(resolvePublic('bad host!')).rejects.toThrow();
    });
    it('validates credentials and allows only mail ports', () => {
        const ok = { email: 'a@b.cz', password: 'x', imapHost: 'IMAP.Example.com', imapPort: 993, smtpHost: 'smtp.example.com', smtpPort: 465 };
        expect(validateCreds(ok).imapHost).toBe('imap.example.com');
        expect(() => validateCreds({ ...ok, imapPort: 22 })).toThrow();
        expect(() => validateCreds({ ...ok, email: 'nope' })).toThrow();
        expect(() => validateCreds({ ...ok, password: '' })).toThrow();
    });
});

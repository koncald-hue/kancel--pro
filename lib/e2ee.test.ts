// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createAdminKeys, unlockAdminKey, wrapForAdmin, unwrapFromAdmin, decryptBytes, decryptText, encryptBytes, encryptText, fromRecoveryCode, generateKey, isEncrypted, masterFromRecovery, setupMaster, unlockMaster, unwrapKey, wrapKey, exportKey, importKey } from './e2ee';

describe('end-to-end encryption', () => {
    it('round-trips text and bytes and never reveals plaintext', async () => {
        const key = await generateKey();
        const secret = await encryptText(key, 'Důvěrná zpráva klientovi');
        expect(isEncrypted(secret)).toBe(true);
        expect(secret).not.toContain('Důvěrná');
        expect(await decryptText(key, secret)).toBe('Důvěrná zpráva klientovi');
        const data = new Uint8Array([1, 2, 3, 250]);
        expect(Array.from(await decryptBytes(key, await encryptBytes(key, data)))).toEqual([1, 2, 3, 250]);
        // dvě šifrování téhož textu dávají různý výsledek (náhodný IV)
        expect(await encryptText(key, 'a')).not.toBe(await encryptText(key, 'a'));
    });

    it('fails with the wrong key or tampered data', async () => {
        const a = await generateKey();
        const b = await generateKey();
        const secret = await encryptText(a, 'tajné');
        await expect(decryptText(b, secret)).rejects.toThrow();
        const tampered = secret.slice(0, -2) + (secret.endsWith('AA') ? 'BB' : 'AA');
        await expect(decryptText(a, tampered)).rejects.toThrow();
    });

    it('protects the master key with a passphrase and a recovery code', async () => {
        const setup = await setupMaster('správné heslo kanceláře', 1000);
        const unlocked = await unlockMaster('správné heslo kanceláře', setup.salt, setup.wrapped, 1000);
        expect(await exportKey(unlocked)).toBe(await exportKey(setup.master));
        await expect(unlockMaster('špatné heslo', setup.salt, setup.wrapped, 1000)).rejects.toThrow();
        expect(fromRecoveryCode(setup.recovery)).toHaveLength(32);
        const recovered = await masterFromRecovery(setup.recovery);
        expect(await exportKey(recovered)).toBe(await exportKey(setup.master));
        expect(() => fromRecoveryCode('abc')).toThrow();
    });

    it('wraps a link key with the master key', async () => {
        const master = await generateKey();
        const linkKey = await generateKey();
        const wrapped = await wrapKey(master, linkKey);
        expect(wrapped).not.toContain(await exportKey(linkKey));
        expect(await exportKey(await unwrapKey(master, wrapped))).toBe(await exportKey(linkKey));
        expect(await exportKey(await importKey(await exportKey(linkKey)))).toBe(await exportKey(linkKey));
    });

    it('lets only the administrator read a document encrypted for them', async () => {
        const admin = await createAdminKeys('heslo správce webu', 1000);
        const fileKey = await generateKey();
        const secret = await encryptBytes(fileKey, new TextEncoder().encode('PRUKAZ-ADVOKATA-123'));
        const wrapped = await wrapForAdmin(admin.publicKey, fileKey);
        const priv = await unlockAdminKey('heslo správce webu', admin.salt, admin.wrappedPrivate, 1000);
        const key = await unwrapFromAdmin(priv, wrapped);
        expect(new TextDecoder().decode(await decryptBytes(key, secret))).toBe('PRUKAZ-ADVOKATA-123');
        await expect(unlockAdminKey('špatné heslo', admin.salt, admin.wrappedPrivate, 1000)).rejects.toThrow();
        expect(admin.wrappedPrivate).not.toContain('PRIVATE');
    });
});

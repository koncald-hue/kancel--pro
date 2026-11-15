import { describe, expect, it } from 'vitest';
import { generateKey } from './e2ee';
import { createMemberKeys, decryptShareFile, encryptShare, fingerprint, openShareMeta, unlockMemberKey } from './e2eeShare';

describe('e2ee sharing between members', () => {
    it('shares a file so that only the recipient and the sender can open it', async () => {
        const masterA = await generateKey(); const masterB = await generateKey(); const masterC = await generateKey();
        const a = await createMemberKeys(masterA); const b = await createMemberKeys(masterB); const c = await createMemberKeys(masterC);
        // jsdom nezná File.arrayBuffer, proto jednoduchá náhrada
        const bytes = new TextEncoder().encode('Důvěrná smlouva');
        const file = { name: 'smlouva.txt', arrayBuffer: async () => bytes.buffer.slice(0) } as unknown as File;
        const share = await encryptShare(file, 'Prosím o kontrolu', b.publicKey, a.publicKey);

        // v úložišti je jen šifrovaný obsah a šifrovaný název
        const readBlob = (b: Blob) => new Promise<Uint8Array>((resolve) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(b); });
        const cipher = await readBlob(share.blob);
        expect(new TextDecoder().decode(cipher)).not.toContain('Důvěrná');
        expect(share.encName).not.toContain('smlouva');

        const privB = await unlockMemberKey(masterB, b.wrappedPrivate);
        const meta = await openShareMeta(privB, share.wrappedForRecipient, share.encName, share.encNote);
        expect(meta).toEqual({ name: 'smlouva.txt', note: 'Prosím o kontrolu' });
        const plain = await decryptShareFile(privB, share.wrappedForRecipient, cipher, meta.name);
        expect(new TextDecoder().decode(await readBlob(plain))).toBe('Důvěrná smlouva');

        // odesílatel si soubor otevře také
        const privA = await unlockMemberKey(masterA, a.wrappedPrivate);
        expect((await openShareMeta(privA, share.wrappedForSender, share.encName, share.encNote)).name).toBe('smlouva.txt');

        // třetí člen ani cizí hlavní klíč nic nepřečtou
        const privC = await unlockMemberKey(masterC, c.wrappedPrivate);
        await expect(openShareMeta(privC, share.wrappedForRecipient, share.encName, share.encNote)).rejects.toBeTruthy();
        await expect(unlockMemberKey(masterA, b.wrappedPrivate)).rejects.toBeTruthy();
    }, 60_000);

    it('computes a stable fingerprint for a public key', async () => {
        const keys = await createMemberKeys(await generateKey());
        const fp = await fingerprint(keys.publicKey);
        expect(fp).toMatch(/^([0-9A-F]{4} ){4}[0-9A-F]{4}$/);
        expect(await fingerprint(keys.publicKey)).toBe(fp);
    }, 30_000);
});

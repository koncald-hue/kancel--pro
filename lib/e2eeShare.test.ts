import { describe, expect, it } from 'vitest';
import { generateKey } from './e2ee';
import { createMemberKeys, decryptAttachment, decryptShareFile, encryptMessage, encryptShare, fingerprint, openMessage, openShareMeta, rewrapMemberKey, unlockMemberKey } from './e2eeShare';

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

    it('re-wraps member keys from an old master to the new one, and rejects a wrong old key', async () => {
        const oldMaster = await generateKey(); const newMaster = await generateKey();
        const created = await createMemberKeys(oldMaster);
        await expect(unlockMemberKey(newMaster, created.wrappedPrivate)).rejects.toThrow();
        const rewrapped = await rewrapMemberKey(oldMaster, newMaster, created.wrappedPrivate);
        await expect(unlockMemberKey(newMaster, rewrapped)).resolves.toBeTruthy();
        await expect(rewrapMemberKey(await generateKey(), newMaster, created.wrappedPrivate)).rejects.toThrow();
    });
    it('computes a stable fingerprint for a public key', async () => {
        const keys = await createMemberKeys(await generateKey());
        const fp = await fingerprint(keys.publicKey);
        expect(fp).toMatch(/^([0-9A-F]{4} ){4}[0-9A-F]{4}$/);
        expect(await fingerprint(keys.publicKey)).toBe(fp);
    }, 30_000);

    it('encrypts chat messages with attachments for the recipient and the sender only', async () => {
        const [mA, mB, mC] = [await generateKey(), await generateKey(), await generateKey()];
        const [a, b, c] = [await createMemberKeys(mA), await createMemberKeys(mB), await createMemberKeys(mC)];
        const payload = { v: 1, kind: 'case', case: { title: 'Novák proti Dvořákovi' }, files: [{ name: 'žaloba.pdf', size: 3, i: 0 }] };
        const msg = await encryptMessage(payload, [new Uint8Array([1, 2, 3])], b.publicKey, a.publicKey);
        expect(msg.encPayload).not.toContain('Novák');
        const readBlob = (blob: Blob) => new Promise<Uint8Array>((resolve) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(blob); });

        const opened = await openMessage<typeof payload>(await unlockMemberKey(mB, b.wrappedPrivate), msg.wrappedForRecipient, msg.encPayload);
        expect(opened.payload.case.title).toBe('Novák proti Dvořákovi');
        expect([...(await decryptAttachment(opened.key, await readBlob(msg.blobs[0])))]).toEqual([1, 2, 3]);
        const fromSender = await openMessage<typeof payload>(await unlockMemberKey(mA, a.wrappedPrivate), msg.wrappedForSender, msg.encPayload);
        expect(fromSender.payload.kind).toBe('case');
        await expect(openMessage(await unlockMemberKey(mC, c.wrappedPrivate), msg.wrappedForRecipient, msg.encPayload)).rejects.toBeTruthy();
    }, 60_000);
});

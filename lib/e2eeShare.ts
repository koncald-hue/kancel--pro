// Šifrované sdílení souborů mezi členy kanceláře.
//  pár klíčů člena (RSA-OAEP)  = veřejný klíč leží v databázi, soukromý je tam jen zašifrovaný hlavním klíčem člena
//  soubor                      = zašifrovaný náhodným klíčem AES-GCM v prohlížeči odesílatele
//  klíč souboru                = zabalený veřejným klíčem příjemce (a odesílatele, aby si ho mohl znovu otevřít)
import { decryptBytes, decryptText, decryptToBlob, encryptBytes, encryptFile, encryptText, fromB64u, generateKey, toB64u, unwrapFromAdmin, wrapForAdmin } from './e2ee';

const subtle = () => globalThis.crypto.subtle;
const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
const RSA = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;

export const MAX_SHARE_BYTES = 25 * 1024 * 1024;

// Nový pár klíčů; soukromá část se zabalí hlavním klíčem člena
export async function createMemberKeys(master: CryptoKey) {
    const pair = await subtle().generateKey(RSA, true, ['encrypt', 'decrypt']);
    const publicKey = JSON.stringify(await subtle().exportKey('jwk', pair.publicKey));
    const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
    return { publicKey, wrappedPrivate: toB64u(await encryptBytes(master, pkcs8)) };
}

export async function unlockMemberKey(master: CryptoKey, wrappedPrivate: string): Promise<CryptoKey> {
    const pkcs8 = await decryptBytes(master, fromB64u(wrappedPrivate)); // jiný hlavní klíč = chyba ověření
    return subtle().importKey('pkcs8', toBuf(pkcs8), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
}

// Klíče zabalené starým hlavním klíčem (po novém nastavení šifrování) se přebalí aktuálním, když uživatel zná starý záchranný kód
export async function rewrapMemberKey(oldMaster: CryptoKey, newMaster: CryptoKey, wrappedPrivate: string): Promise<string> {
    const pkcs8 = await decryptBytes(oldMaster, fromB64u(wrappedPrivate)); // nesprávný starý klíč = chyba ověření
    return toB64u(await encryptBytes(newMaster, pkcs8));
}

// Otisk veřejného klíče k ověření po telefonu (např. „A1B2 C3D4 …“)
export async function fingerprint(publicKeyJwk: string): Promise<string> {
    const jwk = JSON.parse(publicKeyJwk) as { n?: string; e?: string };
    const digest = new Uint8Array(await subtle().digest('SHA-256', new TextEncoder().encode(`${jwk.n ?? ''}.${jwk.e ?? ''}`)));
    const hex = Array.from(digest.slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return (hex.match(/.{4}/g) ?? []).join(' ');
}

export type EncryptedShare = { blob: Blob; encName: string; encNote: string; wrappedForRecipient: string; wrappedForSender: string };

export async function encryptShare(file: File, note: string, recipientPublicKey: string, senderPublicKey: string): Promise<EncryptedShare> {
    const key = await generateKey();
    const { blob, encName } = await encryptFile(key, file);
    return {
        blob, encName,
        encNote: note.trim() ? await encryptText(key, note.trim().slice(0, 1000)) : '',
        wrappedForRecipient: await wrapForAdmin(recipientPublicKey, key),
        wrappedForSender: await wrapForAdmin(senderPublicKey, key),
    };
}

// Název a poznámka (bez stažení souboru)
export async function openShareMeta(privateKey: CryptoKey, wrappedKey: string, encName: string, encNote: string): Promise<{ name: string; note: string }> {
    const key = await unwrapFromAdmin(privateKey, wrappedKey);
    return { name: await decryptText(key, encName), note: encNote ? await decryptText(key, encNote) : '' };
}

export async function decryptShareFile(privateKey: CryptoKey, wrappedKey: string, cipher: Uint8Array, name: string): Promise<Blob> {
    const key = await unwrapFromAdmin(privateKey, wrappedKey);
    return decryptToBlob(key, cipher, name);
}

// ---------- Zprávy (chat mezi členy kanceláře) ----------
// Zpráva = obsah (JSON) zašifrovaný náhodným klíčem + volitelné přílohy zašifrované týmž klíčem.
// Klíč zprávy je zabalený veřejným klíčem příjemce i odesílatele.
export type EncryptedMessage = { encPayload: string; wrappedForRecipient: string; wrappedForSender: string; blobs: Blob[] };

export async function encryptMessage(payload: unknown, attachments: Uint8Array[], recipientPublicKey: string, senderPublicKey: string): Promise<EncryptedMessage> {
    const key = await generateKey();
    const blobs: Blob[] = [];
    for (const data of attachments) blobs.push(new Blob([toBuf(await encryptBytes(key, data))], { type: 'application/octet-stream' }));
    return {
        encPayload: await encryptText(key, JSON.stringify(payload)),
        wrappedForRecipient: await wrapForAdmin(recipientPublicKey, key),
        wrappedForSender: await wrapForAdmin(senderPublicKey, key),
        blobs,
    };
}

export async function openMessage<T>(privateKey: CryptoKey, wrappedKey: string, encPayload: string): Promise<{ payload: T; key: CryptoKey }> {
    const key = await unwrapFromAdmin(privateKey, wrappedKey);
    return { payload: JSON.parse(await decryptText(key, encPayload)) as T, key };
}

export async function decryptAttachment(key: CryptoKey, cipher: Uint8Array): Promise<Uint8Array> {
    return decryptBytes(key, cipher);
}

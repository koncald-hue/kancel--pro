// End-to-end šifrování komunikace advokáta s klientem (WebCrypto, AES-256-GCM).
// Klíče vznikají a zůstávají v prohlížečích. Server a databáze vidí jen zašifrovaná data.
//
//  hlavní klíč advokáta  = náhodný klíč, zabalený osobním šifrovacím heslem (PBKDF2) a záložně záchranným kódem
//  klíč odkazu (věci)    = náhodný klíč, zabalený hlavním klíčem a uložený u odkazu
//  odkaz pro klienta     = https://…/klient/<token>#k=<klíč odkazu>; část za # se na server nikdy neodesílá

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

export const PREFIX = 'e1:';
export const KDF_ITERATIONS = 600_000;

export function toB64u(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64u(text: string): Uint8Array {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

export async function generateKey(): Promise<CryptoKey> {
    return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
export async function exportKey(key: CryptoKey): Promise<string> {
    return toB64u(new Uint8Array(await subtle().exportKey('raw', key)));
}
export async function importKey(text: string): Promise<CryptoKey> {
    return subtle().importKey('raw', toBuf(fromB64u(text)), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, toBuf(data)));
    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv);
    out.set(ct, iv.length);
    return out;
}
export async function decryptBytes(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: toBuf(blob.slice(0, 12)) }, key, toBuf(blob.slice(12))));
}

export const isEncrypted = (text: string | null | undefined): boolean => !!text && text.startsWith(PREFIX);
export async function encryptText(key: CryptoKey, text: string): Promise<string> {
    return PREFIX + toB64u(await encryptBytes(key, te.encode(text)));
}
export async function decryptText(key: CryptoKey, text: string): Promise<string> {
    return td.decode(await decryptBytes(key, fromB64u(text.slice(PREFIX.length))));
}

// Hlavní klíč a osobní šifrovací heslo
async function deriveKek(passphrase: string, salt: Uint8Array, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
    const base = await subtle().importKey('raw', te.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', salt: toBuf(salt), iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const toRecoveryCode = (raw: Uint8Array) => (Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join('').match(/.{8}/g) ?? []).join('-');
export function fromRecoveryCode(code: string): Uint8Array {
    const hex = code.replace(/[^0-9a-fA-F]/g, '');
    if (hex.length !== 64) throw new Error('Záchranný kód nemá správný tvar.');
    return Uint8Array.from(hex.match(/.{2}/g)!, (h) => parseInt(h, 16));
}

export async function setupMaster(passphrase: string, iterations = KDF_ITERATIONS) {
    const master = await generateKey();
    const raw = new Uint8Array(await subtle().exportKey('raw', master));
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKek(passphrase, salt, iterations);
    return { master, salt: toB64u(salt), wrapped: toB64u(await encryptBytes(kek, raw)), recovery: toRecoveryCode(raw) };
}
export async function unlockMaster(passphrase: string, saltB64: string, wrappedB64: string, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
    const kek = await deriveKek(passphrase, fromB64u(saltB64), iterations);
    const raw = await decryptBytes(kek, fromB64u(wrappedB64)); // špatné heslo = chyba ověření
    return subtle().importKey('raw', toBuf(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);
}
// Záchranný kód je surový hlavní klíč; z odemčeného klíče jde kdykoli znovu zobrazit
export async function recoveryCodeOf(master: CryptoKey): Promise<string> {
    return toRecoveryCode(new Uint8Array(await subtle().exportKey('raw', master)));
}
export async function masterFromRecovery(code: string): Promise<CryptoKey> {
    return subtle().importKey('raw', toBuf(fromRecoveryCode(code)), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// Klíč odkazu zabalený hlavním klíčem advokáta
export async function wrapKey(master: CryptoKey, key: CryptoKey): Promise<string> {
    return toB64u(await encryptBytes(master, new Uint8Array(await subtle().exportKey('raw', key))));
}
export async function unwrapKey(master: CryptoKey, wrapped: string): Promise<CryptoKey> {
    return subtle().importKey('raw', toBuf(await decryptBytes(master, fromB64u(wrapped))), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// Odemčený hlavní klíč zůstává pouze v paměti této stránky.
let masterKey: CryptoKey | null = null;
const listeners = new Set<() => void>();
export const getMaster = () => masterKey;
export const subscribeMaster = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
// Proč je klíč zamčený: 'idle' = zamčeno po nečinnosti, 'reload' = stránka se obnovila (klíč v paměti zanikl),
// 'logout' = odhlášení. Ukládá se jen příznak (ne klíč), aby šlo uživateli vysvětlit, co se stalo.
export type LockReason = 'idle' | 'reload' | 'logout' | null;
export const IDLE_LOCK_MS = 30 * 60_000;
const FLAG = 'e2eeWasUnlocked';
let lockReason: LockReason = null;
let idleTimer: number | null = null;
let lastActivity = 0;
export const getLockReason = () => lockReason;

function onActivity() {
    const now = Date.now();
    if (now - lastActivity < 5_000) return; // stačí zaznamenat aktivitu jednou za pár sekund
    lastActivity = now;
    armIdle();
}
function armIdle() {
    if (typeof window === 'undefined') return;
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { void setMaster(null, 'idle'); }, IDLE_LOCK_MS);
}
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
function watchActivity(on: boolean) {
    if (typeof window === 'undefined') return;
    for (const ev of EVENTS) { if (on) window.addEventListener(ev, onActivity, { passive: true }); else window.removeEventListener(ev, onActivity); }
    if (!on && idleTimer !== null) { window.clearTimeout(idleTimer); idleTimer = null; }
}

export async function setMaster(key: CryptoKey | null, reason: Exclude<LockReason, 'reload'> = null) {
    masterKey = key;
    lockReason = key ? null : reason;
    try {
        sessionStorage.removeItem('e2eeMaster');
        if (key) sessionStorage.setItem(FLAG, '1'); else sessionStorage.removeItem(FLAG);
    } catch { /* úložiště nemusí být dostupné */ }
    if (key) { watchActivity(true); armIdle(); } else watchActivity(false);
    listeners.forEach((fn) => fn());
}
export const clearLockReason = () => { lockReason = null; listeners.forEach((fn) => fn()); };
export async function restoreMaster() {
    if (masterKey) return;
    try {
        sessionStorage.removeItem('e2eeMaster');
        // Klíč byl v této kartě odemčený, ale obnovením stránky zanikl: vysvětlíme to uživateli
        if (sessionStorage.getItem(FLAG) === '1' && lockReason === null) { lockReason = 'reload'; sessionStorage.removeItem(FLAG); listeners.forEach((fn) => fn()); }
    } catch { /* úložiště nemusí být dostupné */ }
}

// Šifrovaný soubor: obsah i název. Název se ukládá jako zašifrovaný text, typ se určí až po dešifrování
export async function encryptFile(key: CryptoKey, file: File): Promise<{ blob: Blob; encName: string }> {
    const data = new Uint8Array(await file.arrayBuffer());
    return { blob: new Blob([toBuf(await encryptBytes(key, data))], { type: 'application/octet-stream' }), encName: await encryptText(key, file.name) };
}
export async function decryptToBlob(key: CryptoKey, cipher: Uint8Array, name: string): Promise<Blob> {
    const plain = await decryptBytes(key, cipher);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const types: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
    return new Blob([toBuf(plain)], { type: types[ext] ?? 'application/octet-stream' });
}

export const KEY_FRAGMENT = 'k';
export const linkWithKey = (url: string, keyB64: string) => `${url}#${KEY_FRAGMENT}=${keyB64}`;

// ---------------------------------------------------------------------------------------------
// Klíč správce (RSA-OAEP): žadatel zašifruje průkaz náhodným klíčem AES a ten zabalí veřejným klíčem
// správce. Soukromý klíč správce je uložený jen zašifrovaný jeho heslem a čte ho jen správce.
const RSA = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;

export async function createAdminKeys(passphrase: string, iterations = KDF_ITERATIONS) {
    const pair = await subtle().generateKey(RSA, true, ['encrypt', 'decrypt']);
    const publicKey = JSON.stringify(await subtle().exportKey('jwk', pair.publicKey));
    const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKek(passphrase, salt, iterations);
    return { publicKey, salt: toB64u(salt), wrappedPrivate: toB64u(await encryptBytes(kek, pkcs8)), privateKey: pair.privateKey };
}

export async function unlockAdminKey(passphrase: string, saltB64: string, wrappedB64: string, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
    const kek = await deriveKek(passphrase, fromB64u(saltB64), iterations);
    const pkcs8 = await decryptBytes(kek, fromB64u(wrappedB64));
    return subtle().importKey('pkcs8', toBuf(pkcs8), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
}

export async function wrapForAdmin(publicKeyJwk: string, key: CryptoKey): Promise<string> {
    const pub = await subtle().importKey('jwk', JSON.parse(publicKeyJwk), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    return toB64u(new Uint8Array(await subtle().encrypt({ name: 'RSA-OAEP' }, pub, await subtle().exportKey('raw', key))));
}

export async function unwrapFromAdmin(privateKey: CryptoKey, wrapped: string): Promise<CryptoKey> {
    const raw = await subtle().decrypt({ name: 'RSA-OAEP' }, privateKey, toBuf(fromB64u(wrapped)));
    return subtle().importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
}

// Odemčený soukromý klíč správce žije jen v paměti stránky (po obnovení se zadá heslo znovu)
let adminKey: CryptoKey | null = null;
const adminListeners = new Set<() => void>();
export const getAdminKey = () => adminKey;
export const subscribeAdminKey = (fn: () => void) => { adminListeners.add(fn); return () => { adminListeners.delete(fn); }; };
export function setAdminKey(key: CryptoKey | null) { adminKey = key; adminListeners.forEach((fn) => fn()); }

// Průkaz pro správce: obsah zašifrovaný náhodným klíčem, klíč zabalený veřejným klíčem správce
export async function encryptForAdmin(publicKeyJwk: string, file: File): Promise<{ blob: Blob; wrappedKey: string }> {
    const key = await generateKey();
    const data = new Uint8Array(await file.arrayBuffer());
    return { blob: new Blob([toBuf(await encryptBytes(key, data))], { type: 'application/octet-stream' }), wrappedKey: await wrapForAdmin(publicKeyJwk, key) };
}

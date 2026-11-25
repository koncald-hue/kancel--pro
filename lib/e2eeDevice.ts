// „Zapamatovat toto zařízení“: hlavní klíč advokáta se uloží v IndexedDB zašifrovaný klíčem zařízení.
// Klíč zařízení je nevyexportovatelný CryptoKey: prohlížeč s ním umí šifrovat, ale jeho hodnotu nikdo nepřečte
// ani nezkopíruje (ani skript na stránce). Server a databáze dál nic nevidí. Záznam patří jen jednomu účtu
// a smaže se odhlášením, tlačítkem Zamknout nebo „Zapomenout toto zařízení“.

const DB = 'kp-e2ee';
const STORE = 'device';
const REC = 'master';

type DeviceRecord = { userId: string; deviceKey: CryptoKey; wrapped: Uint8Array };

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const req = fn(db.transaction(STORE, mode).objectStore(STORE));
            req.onsuccess = () => resolve(req.result as T);
            req.onerror = () => reject(req.error);
        });
    } finally { db.close(); }
}

const available = () => typeof indexedDB !== 'undefined' && !!globalThis.crypto?.subtle;

export async function rememberDevice(userId: string, master: CryptoKey): Promise<boolean> {
    if (!available()) return false;
    try {
        const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const raw = new Uint8Array(await crypto.subtle.exportKey('raw', master));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, raw));
        const wrapped = new Uint8Array(12 + ct.length); wrapped.set(iv); wrapped.set(ct, 12);
        await tx('readwrite', (s) => s.put({ userId, deviceKey, wrapped } satisfies DeviceRecord, REC));
        return true;
    } catch { return false; }
}

export async function loadRememberedMaster(userId: string): Promise<CryptoKey | null> {
    if (!available()) return null;
    try {
        const rec = await tx<DeviceRecord | undefined>('readonly', (s) => s.get(REC));
        if (!rec || rec.userId !== userId) return null;
        const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.wrapped.slice(0, 12) }, rec.deviceKey, rec.wrapped.slice(12));
        return await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
    } catch { return null; }
}

export async function isDeviceRemembered(userId: string): Promise<boolean> {
    if (!available()) return false;
    try { const rec = await tx<DeviceRecord | undefined>('readonly', (s) => s.get(REC)); return !!rec && rec.userId === userId; } catch { return false; }
}

export async function forgetDevice(): Promise<void> {
    if (!available()) return;
    try { await tx('readwrite', (s) => s.delete(REC)); } catch { /* nic k zapomenutí */ }
}

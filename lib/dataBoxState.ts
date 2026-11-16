import type { Record_ } from './isds';
import { isNewMessage } from './isds';

// Sdílený stav datových schránek v prohlížeči (jen v paměti): počet nových zpráv pro ikonu, načtené zprávy pro hledání
// a žádost o otevření panelu z jiného místa (např. z hledání).
type Listener = () => void;
const listeners = new Set<Listener>();
const cache = new Map<string, Record_[]>();
let openRequests = 0;
let version = 0;

const bump = () => { version += 1; listeners.forEach((l) => l()); };

export const subscribeBox = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const boxVersion = () => version;

// Načtené přijaté zprávy schránky; z nich se počítají nové
export function setReceived(accountId: string, records: Record_[]) { cache.set(accountId, records); bump(); }
export const clearBoxState = () => { cache.clear(); bump(); };
export const newCount = () => [...cache.values()].reduce((s, list) => s + list.filter((r) => isNewMessage(r.status)).length, 0);
export const cachedMessages = () => [...cache.values()].flat();

export const requestOpen = () => { openRequests += 1; bump(); };
export const openRequestCount = () => openRequests;

const strip = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Hledání ve zprávách načtených z datové schránky (odesílatel, věc zprávy, adresát), bez diakritiky
export function searchCached(query: string, limit = 8): Record_[] {
    const q = strip(query.trim());
    if (q.length < 2) return [];
    return cachedMessages().filter((r) => strip(`${r.sender} ${r.annotation} ${r.recipient}`).includes(q)).slice(0, limit);
}

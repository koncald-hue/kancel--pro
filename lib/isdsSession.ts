// Relace do datové schránky (Mobilní klíč) drží prohlížeč jen v paměti. Přežije zavření panelu, ale:
//  * vyprší po nečinnosti (ISDS ji ruší po 30 minutách, my o něco dřív),
//  * odhlášením z Kanceláře se ukončí i v datové schránce.
export const IDLE_LIMIT_MS = 25 * 60_000;

type Entry = { env: 'test' | 'prod'; value: string; lastUsed: number };
const store = new Map<string, Entry>();

export function getSession(key: string, now = Date.now()): Entry | null {
    const e = store.get(key);
    if (!e) return null;
    if (now - e.lastUsed > IDLE_LIMIT_MS) { store.delete(key); return null; }
    return e;
}
export const touchSession = (key: string, now = Date.now()) => { const e = store.get(key); if (e) e.lastUsed = now; };
export const putSession = (key: string, env: 'test' | 'prod', value: string, now = Date.now()) => { store.set(key, { env, value, lastUsed: now }); };
export const dropSession = (key: string) => { store.delete(key); };
export const hasSessions = () => store.size > 0;

// Odhlásí všechny relace v datových schránkách (volá se při odhlášení z Kanceláře)
export async function endAllSessions(send: (env: 'test' | 'prod', session: string) => Promise<unknown>): Promise<void> {
    const all = [...store.values()];
    store.clear();
    await Promise.allSettled(all.map((e) => send(e.env, e.value)));
}

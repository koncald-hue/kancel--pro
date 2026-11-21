// Záznam chyb: čištění textu před odesláním a filtr běžného šumu. Čisté funkce.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const TOKEN = /[A-Za-z0-9_-]{28,}/g;
const URL_QUERY = /(https?:\/\/[^\s?#"')]+)[?#][^\s"')]*/g;

// Z textu chyby se odstraní e-maily, identifikátory, dlouhé klíče a parametry adres
export function scrub(text: string, max: number): string {
    return text.replace(URL_QUERY, '$1').replace(EMAIL, ':email').replace(UUID, ':id').replace(TOKEN, ':token').slice(0, max);
}

export function pagePath(path: string): string {
    return path.split(/[?#]/)[0].replace(UUID, ':id').slice(0, 200);
}

// Chyby, které nejsou naše: rozšíření prohlížeče, zrušené požadavky, běžný šum
export function isNoise(message: string, stack = ''): boolean {
    const m = message.toLowerCase();
    if (!m.trim()) return true;
    if (m.includes('resizeobserver loop') || m === 'script error.' || m.includes('non-error promise rejection')) return true;
    if (m.includes('abort') && (m.includes('fetch') || m.includes('request') || m.includes('signal'))) return true;
    if (m.includes('failed to fetch') || m.includes('load failed') || m.includes('networkerror')) return true; // výpadek spojení uživatele
    return /(chrome|moz|safari)-extension:\/\//i.test(stack + message);
}

export function fingerprint(message: string, page: string): string {
    return `${message.slice(0, 120)}|${page}`.slice(0, 200);
}

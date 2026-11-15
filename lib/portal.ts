// Společné pomůcky klientského odkazu a poptávek (server i prohlížeč)

// Náhodný token o 256 bitech v URL-bezpečném zápisu
export function generateToken(bytes = 32): string {
    const data = crypto.getRandomValues(new Uint8Array(bytes));
    let binary = '';
    for (const b of data) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const isValidToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const isValidIntakeCode = (code: string) => /^[a-z0-9-]{4,40}$/.test(code);

export type LinkState = { revoked: boolean; expires_at: string | null };
export function isLinkActive(link: LinkState, now = new Date()): boolean {
    return !link.revoked && (!link.expires_at || new Date(link.expires_at).getTime() > now.getTime());
}

// Povolené přílohy od klientů (žádné spustitelné soubory ani HTML)
export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'odt', 'rtf', 'txt', 'png', 'jpg', 'jpeg', 'heic', 'webp'];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export function isAllowedUpload(name: string, size: number): string | null {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Tento typ souboru nelze nahrát. Povolené jsou dokumenty (PDF, Word, Excel, text) a obrázky.';
    if (size > MAX_UPLOAD_BYTES) return 'Soubor je větší než 15 MB.';
    if (size <= 0) return 'Soubor je prázdný.';
    return null;
}

export const portalUrl = (origin: string, token: string) => `${origin}/klient/${token}`;
export const intakeUrl = (origin: string, code: string) => `${origin}/poptavka/${code}`;

// Stručné slovní šablony stavu věci pro advokáta
export const STATUS_TEMPLATES = [
    'Věc jsme převzali a připravujeme další postup.',
    'Podání jsme odeslali. Čekáme na vyjádření.',
    'Čekáme na rozhodnutí soudu nebo úřadu.',
    'Potřebujeme od vás doplnit podklady (viz níže).',
    'Věc je vyřízena. Děkujeme za důvěru.',
] as const;

// Společná věta o zabezpečení: pravdivě, bez slibu end-to-end šifrování
export const SECURITY_TEXT_CLIENT = 'Spojení je šifrované a soubory i zprávy jsou uložené šifrovaně v soukromém úložišti. Přes web k nim mají přístup jen vy (přes tento odkaz) a váš advokát.';
export const SECURITY_TEXT_LAWYER = 'Data jsou přenášena šifrovaně (HTTPS) a uložena šifrovaně (AES-256) v soukromém úložišti. Přístup mají jen advokát a klient s jeho soukromým odkazem, který lze kdykoli zrušit. Nejde o end-to-end šifrování: provozovatel služby má technický přístup k infrastruktuře.';

// Údaje, které klient vyplňuje před vstupem do věci
export type ClientIdentity = { name: string; email: string; phone: string; address: string; consent: boolean };
export function validateIdentity(i: ClientIdentity): string | null {
    if (i.name.trim().length < 2) return 'Vyplňte své jméno a příjmení.';
    if (!i.email.trim() && !i.phone.trim()) return 'Uveďte aspoň e-mail nebo telefon, ať vás advokát zastihne.';
    if (i.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) return 'E-mail nevypadá správně.';
    if (!i.consent) return 'Pro pokračování je potřeba souhlas se zpracováním údajů.';
    return null;
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const SECURITY_TEXT_CLIENT_E2EE = 'Zprávy a soubory jsou end-to-end šifrované: dešifruje je jen váš prohlížeč klíčem, který je v tomto odkazu za znakem #. Nikdo další je přečíst nemůže, ani provozovatel webu. Odkaz proto otevírejte celý a nikomu ho nepředávejte.';

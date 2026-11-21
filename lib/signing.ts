// Elektronický podpis dokumentů v klientském portálu: pokročilý podpis s ověřením identity a SMS kódem,
// doklad o podpisu a pomocné funkce. Čisté funkce pro server i prohlížeč.

export type SignLevel = 'advanced' | 'qualified';
export type SignKind = 'smlouva' | 'souhlas' | 'protokol' | 'plna_moc' | 'podani' | 'jine';
export type SignStatus = 'pending' | 'signed' | 'awaiting_check' | 'declined' | 'cancelled' | 'expired';
export type IdentityMethod = 'bankid' | 'lawyer' | 'none';

export const KINDS: Record<SignKind, { label: string; level: SignLevel; note: string }> = {
    smlouva: { label: 'Smlouva o poskytování právních služeb', level: 'advanced', note: 'Pro smlouvu mezi advokátem a klientem stačí podpis s ověřením totožnosti.' },
    souhlas: { label: 'Souhlas (např. se zpracováním údajů)', level: 'advanced', note: 'Podpis s ověřením totožnosti stačí.' },
    protokol: { label: 'Předávací protokol, potvrzení převzetí', level: 'advanced', note: 'Podpis s ověřením totožnosti stačí.' },
    plna_moc: { label: 'Plná moc', level: 'qualified', note: 'Pro zastoupení před soudem a úřady ověřte, jakou formu konkrétní soud nebo úřad vyžaduje. Pokud trvá na kvalifikovaném podpisu, běžný podpis s ověřením totožnosti nemusí stačit.' },
    podani: { label: 'Podání nebo dokument pro soud či úřad', level: 'qualified', note: 'Rozhoduje požadavek konkrétního soudu nebo úřadu. Aplikace kvalifikovaný podpis sama nevytváří.' },
    jine: { label: 'Jiný dokument', level: 'advanced', note: 'Stačí podpis s ověřením totožnosti, pokud ho příjemce dokumentu uzná.' },
};
export const defaultLevel = (kind: SignKind): SignLevel => KINDS[kind].level;

export const LEVEL_LABEL: Record<SignLevel, string> = { advanced: 'Podpis s ověřením totožnosti (online nebo osobně + jednorázový kód)', qualified: 'Kvalifikovaný podpis (mimo aplikaci)' };
export const STATUS_LABEL: Record<SignStatus, string> = { pending: 'Čeká na podpis', signed: 'Podepsáno', awaiting_check: 'Čeká na ověření advokátem', declined: 'Odmítnuto', cancelled: 'Zrušeno', expired: 'Vypršelo' };

// Prohlášení, které klient před podpisem potvrdí; ukládá se do dokladu
export const CONSENT_TEXT = 'Seznámil/a jsem se s celým zněním dokumentu a souhlasím s ním. Chápu, že potvrzení SMS kódem po ověření mé totožnosti je můj elektronický podpis tohoto dokumentu.';

export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const digest = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export const isSha256 = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);

export function maskPhone(phone: string): string {
    const d = phone.replace(/[^\d+]/g, '');
    return d.length <= 5 ? '***' : `${d.slice(0, d.startsWith('+') ? 4 : 0)}${'•'.repeat(Math.max(3, d.length - (d.startsWith('+') ? 7 : 3)))}${d.slice(-3)}`;
}
// Telefon pro SMS: český formát převede na mezinárodní (+420…); jinak vrací null
export function normalizePhone(raw: string): string | null {
    const d = raw.replace(/[\s().-]/g, '');
    if (/^\+\d{8,15}$/.test(d)) return d;
    if (/^00\d{8,15}$/.test(d)) return `+${d.slice(2)}`;
    if (/^\d{9}$/.test(d)) return `+420${d}`;
    return null;
}

export type Evidence = {
    v: 1;
    requestId: string; title: string; level: 'advanced'; docSha256: string;
    signer: { name: string; typedName?: string; phoneMasked: string; emailMasked?: string };
    identity: { method: IdentityMethod; provider?: string; given?: string; family?: string; birthdate?: string; sub?: string; verifiedAt?: string; note?: string; phoneMatch?: boolean };
    otp: { channel: 'sms' | 'lawyer' | 'email'; verifiedAt: string };
    signedAt: string; ip: string; userAgent: string; consent: string;
    // U balíčku: všechny dokumenty podepsané jedním kódem (každý doklad uvádí celý balíček)
    package?: { id: string; documents: { requestId: string; title: string; docSha256: string }[] };
};

// Stabilní zápis JSON (seřazené klíče), aby šel doklad vždy stejně zapečetit i ověřit
export function canonicalJson(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonicalJson(x)}`).join(',')}}`;
    return JSON.stringify(v);
}

async function hmac(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))), (b) => b.toString(16).padStart(2, '0')).join('');
}
export const sealEvidence = (secret: string, e: Evidence) => hmac(secret, canonicalJson(e));
export async function verifySeal(secret: string, e: Evidence, seal: string): Promise<boolean> { return (await sealEvidence(secret, e)) === seal; }

// SMS kód
export function generateOtp(): string { const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000; return String(n).padStart(6, '0'); }
export const otpHash = (secret: string, requestId: string, code: string) => hmac(secret, `otp:${requestId}:${code}`);
export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 3;

export function isExpired(req: { expires_at: string | null }, now = new Date()): boolean { return !!req.expires_at && new Date(req.expires_at).getTime() <= now.getTime(); }

// Jména se porovnávají bez diakritiky, velikosti písmen a pořadí slov
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean).sort().join(' ');
export const sameName = (a: string, b: string) => !!fold(a) && fold(a) === fold(b);

// Balíček = víc dokumentů téže osoby a téhož způsobu ověření, podepsaných jedním kódem
export type PackageRow = { id: string; created_at: string; signer_name: string; signer_phone: string; signer_email: string; identity_method: string; level: string; status: string };
export function packageProblem(rows: PackageRow[]): string | null {
    if (rows.length < 1) return 'Balíček neexistuje nebo už nejde podepsat.';
    const f = rows[0];
    if (rows.some((r) => r.level !== 'advanced')) return 'Balíček smí obsahovat jen dokumenty s podpisem s ověřením totožnosti.';
    if (rows.some((r) => !sameName(r.signer_name, f.signer_name) || r.identity_method !== f.identity_method)) return 'Dokumenty v balíčku musí podepisovat táž osoba se stejným ověřením.';
    return null;
}
// Kód i ověření totožnosti se vážou na první dokument balíčku (nejstarší, při shodě podle id)
export const leadOf = <T extends { id: string; created_at: string }>(rows: T[]): T => [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0];

// Plán připomínek nepodepsaným žádostem: po 2. a po 5. dni od vytvoření; po vypršení platnosti se jednou upozorní advokát
export type ReminderRow = { id: string; status: string; created_at: string; expires_at: string | null; reminder_count: number; expiry_notified: boolean; signer_email: string; level: string };
export const REMINDER_DAYS = [2, 5] as const;
export function planReminder(r: ReminderRow, now = new Date()): 'remind' | 'expire' | null {
    if (r.status !== 'pending' || r.level !== 'advanced') return null;
    if (isExpired(r, now)) return r.expiry_notified ? null : 'expire';
    const days = (now.getTime() - new Date(r.created_at).getTime()) / 86_400_000;
    const due = REMINDER_DAYS.filter((d) => days >= d).length;
    return r.signer_email && r.reminder_count < due ? 'remind' : null;
}

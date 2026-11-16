// QR platba (český standard SPAYD) a převod českého čísla účtu na IBAN.
export const onlyDigits = (s: string) => s.replace(/\D/g, '');

const mod97 = (numeric: string) => { let r = 0; for (const ch of numeric) r = (r * 10 + Number(ch)) % 97; return r; };
const letters = (s: string) => s.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));

export function ibanValid(iban: string): boolean {
    const t = iban.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t)) return false;
    return mod97(letters(t.slice(4) + t.slice(0, 4))) === 1;
}

// Číslo účtu „předčíslí-číslo/kód banky“ (nebo IBAN) na IBAN; neplatný vstup vrátí null
export function toIban(input: string): string | null {
    const t = input.trim().replace(/\s+/g, '');
    if (/^[A-Za-z]{2}\d{2}/.test(t)) { const up = t.toUpperCase(); return ibanValid(up) ? up : null; }
    const m = t.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
    if (!m) return null;
    const bban = `${m[3]}${(m[1] ?? '').padStart(6, '0')}${m[2].padStart(10, '0')}`;
    const check = String(98 - mod97(`${bban}123500`)).padStart(2, '0');
    const iban = `CZ${check}${bban}`;
    return ibanValid(iban) ? iban : null;
}

export const formatIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

// Text zprávy pro příjemce: bez diakritiky a jen povolené znaky, nejvýše 60 znaků
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .,:/\-_()]/g, ' ').replace(/\s+/g, ' ').trim();

export type SpaydInput = { iban: string; amount: number; currency: 'CZK' | 'EUR'; vs?: string; message?: string; due?: string; name?: string };
export function spayd(i: SpaydInput): string | null {
    const iban = toIban(i.iban);
    if (!iban || !(i.amount > 0) || i.amount > 9_999_999_999.99) return null;
    const parts = ['SPD', '1.0', `ACC:${iban}`, `AM:${i.amount.toFixed(2)}`, `CC:${i.currency}`];
    const vs = onlyDigits(i.vs ?? '').slice(0, 10);
    if (vs) parts.push(`X-VS:${vs}`);
    const msg = plain(i.message ?? '').slice(0, 60).replace(/\*/g, '');
    if (msg) parts.push(`MSG:${msg}`);
    if (i.due && /^\d{4}-\d{2}-\d{2}$/.test(i.due)) parts.push(`DT:${i.due.replace(/-/g, '')}`);
    const rn = plain(i.name ?? '').slice(0, 35).replace(/\*/g, '');
    if (rn) parts.push(`RN:${rn}`);
    return parts.join('*');
}

// Vektorový obrázek QR kódu (SVG) vygenerovaný přímo v prohlížeči, nic se nikam neposílá
export async function qrSvg(text: string, size = 160): Promise<string> {
    const QR = await import('qrcode');
    const svg = await QR.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
}

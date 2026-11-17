// ARES (Administrativní registr ekonomických subjektů): veřejný registr firem a podnikatelů. Bez klíče, jen veřejné údaje.
export const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

export type AresCompany = { ico: string; name: string; dic: string; address: string; ended?: string | null };

// IČO má 8 číslic a poslední je kontrolní (modulo 11)
export function isValidIco(input: string): boolean {
    const ico = input.replace(/\s+/g, '');
    if (!/^\d{8}$/.test(ico)) return false;
    const sum = [...ico.slice(0, 7)].reduce((s, d, i) => s + Number(d) * (8 - i), 0);
    const check = (11 - (sum % 11)) % 10;
    return check === Number(ico[7]);
}

export const cleanIco = (input: string) => input.replace(/\s+/g, '');

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// Z odpovědi ARES vezme jen to, co potřebujeme pro klienta nebo fakturu
export function normalizeCompany(raw: unknown): AresCompany | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const ico = str(r.ico);
    const name = str(r.obchodniJmeno);
    if (!/^\d{8}$/.test(ico) || !name) return null;
    const sidlo = (r.sidlo && typeof r.sidlo === 'object' ? r.sidlo : {}) as Record<string, unknown>;
    const ended = str(r.datumZaniku).slice(0, 10);
    return { ico, name, dic: str(r.dic), address: str(sidlo.textovaAdresa), ended: /^\d{4}-\d{2}-\d{2}$/.test(ended) ? ended : null };
}

// Hledání podle názvu je pomalejší a méně přesné než podle IČO; stačí pár znaků
export const isSearchableName = (q: string) => q.trim().length >= 3 && q.trim().length <= 80;

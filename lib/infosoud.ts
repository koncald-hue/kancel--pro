// InfoSoud (infosoud.gov.cz): veřejná služba Ministerstva spravedlnosti o průběhu soudních řízení.
// Nemá zveřejněné API ani podmínky pro strojový přístup, proto ji Kancelář sama nečte. Jen připraví údaje
// ze spisové značky pro formulář InfoSoudu a otevře ho v prohlížeči advokáta.
export const INFOSOUD_URL = 'https://infosoud.gov.cz/InfoSoud';

export type FileNumber = { senat: number | null; druh: string; cislo: number; rocnik: number; text: string };

// „10 C 123/2024“, „10 C 123/2024-45“, „29 Cdo 1234/2020“, „KSPL 20 INS 1234/2023“, „Nc 5/2025“
const RE = /(?:^|\s)(?:[A-Z]{2,6}\s+)?(\d{1,4})?\s*([A-Za-z]{1,6}(?:\s+A\s+NC)?)\s+(\d{1,7})\s*\/\s*(\d{4}|\d{2})(?:\s*-\s*\d+)?(?:\s|$|[,;.])/;

export function parseFileNumber(raw: string): FileNumber | null {
    const s = (raw ?? '').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    const m = RE.exec(` ${s} `);
    if (!m) return null;
    const druhRaw = m[2].trim();
    // Druh věci (rejstřík) je zkratka písmen; „INS“, „Cdo“, „T“, „C“… Odmítneme slova, která zkratkou nejsou
    if (/^(sp|zn|cj|č|j)$/i.test(druhRaw)) return null;
    let rocnik = Number(m[4]);
    if (m[4].length === 2) rocnik += rocnik > 50 ? 1900 : 2000;
    const year = new Date().getFullYear();
    if (rocnik < 1990 || rocnik > year + 1) return null;
    const senat = m[1] ? Number(m[1]) : null;
    const druh = druhRaw.length <= 2 ? druhRaw.toUpperCase() : druhRaw.charAt(0).toUpperCase() + druhRaw.slice(1);
    return { senat, druh, cislo: Number(m[3]), rocnik, text: `${senat !== null ? `${senat} ` : ''}${druh} ${Number(m[3])}/${rocnik}` };
}

// Vypadá označení úřadu jako soud? (InfoSoud pokrývá jen soudy)
export const isCourt = (authority: string) => /soud/i.test(authority ?? '');

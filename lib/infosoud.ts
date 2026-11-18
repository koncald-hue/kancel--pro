// InfoSoud (infosoud.gov.cz): veřejná služba Ministerstva spravedlnosti o průběhu soudních řízení.
// Nemá zveřejněné API ani podmínky pro strojový přístup, proto ji Kancelář sama nečte. Jen připraví údaje
// ze spisové značky pro formulář InfoSoudu a otevře ho v prohlížeči advokáta.
import { DISTRICT_COURTS } from './infosoudCourts';
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

const foldName = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Přiřadí text „Okresní soud Plzeň-město“, „OS Plzeň-město“ nebo „Obvodní soud pro Prahu 1“ ke kódu okresního soudu. Jinak null.
export function districtCourtCode(authority: string): string | null {
    const a = foldName(authority ?? ''); if (!a) return null;
    const exact = DISTRICT_COURTS.find(([n]) => foldName(n) === a); if (exact) return exact[1];
    const m = a.replace(/^(okresni soud|obvodni soud|mestsky soud|os)( pro)? /, '');
    const hits = DISTRICT_COURTS.filter(([n]) => foldName(n).replace(/^(okresni soud|obvodni soud|mestsky soud) /, '') === m);
    return hits.length === 1 ? hits[0][1] : null;
}

// Přímý odkaz, který v InfoSoudu rovnou vyhledá řízení. Jen pro okresní soudy se senátem a ročníkem od 2007
// (jiné InfoSoud nezobrazuje). Odkaz otevře uživatel sám, vyhledání proběhne v jeho prohlížeči.
export function infosoudDirectLink(fn: FileNumber, authority: string): string | null {
    const code = districtCourtCode(authority);
    if (!code || fn.senat === null || fn.rocnik < 2007) return null;
    const q = new URLSearchParams({ typOrganizace: 'VSECHNY_KRAJE', okresniSoud: code, cisloSenatu: String(fn.senat), druhVeci: fn.druh.toUpperCase(), bcVec: String(fn.cislo), rocnik: String(fn.rocnik) });
    return `${INFOSOUD_URL}/detail-rizeni?${q.toString()}`;
}

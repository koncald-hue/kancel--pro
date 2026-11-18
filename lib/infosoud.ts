// InfoSoud (infosoud.gov.cz): veřejná služba Ministerstva spravedlnosti o průběhu soudních řízení.
// Nemá zveřejněné API ani podmínky pro strojový přístup, proto ji Kancelář sama nečte. Jen připraví údaje
// ze spisové značky pro formulář InfoSoudu a otevře ho v prohlížeči advokáta.
import { DISTRICT_COURTS, HIGHER_COURTS } from './infosoudCourts';
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

// Zkratky ze spisových značek a z textu v poli „Soud“: „OS Plzeň-město“, „KS Plzeň“, „MS Praha“, „VS Olomouc“
const expand = (a: string) => a.replace(/^os /, 'okresni soud ').replace(/^ks /, 'krajsky soud ').replace(/^ms /, 'mestsky soud ').replace(/^vs /, 'vrchni soud ');

export type CourtRef = { kind: 'okresni' | 'vyssi'; code: string };
// Přiřadí text „Okresní soud Plzeň-město“, „KS Plzeň“ nebo „Krajský soud v Plzni“ ke kódu soudu v InfoSoudu. Jinak null.
export function courtRef(authority: string): CourtRef | null {
    const a = expand(foldName(authority ?? '')); if (!a) return null;
    const higher = HIGHER_COURTS.find((c) => c.names.some((n) => foldName(n) === a)); if (higher) return { kind: 'vyssi', code: higher.code };
    const exact = DISTRICT_COURTS.find(([n]) => foldName(n) === a); if (exact) return { kind: 'okresni', code: exact[1] };
    const m = a.replace(/^(okresni soud|obvodni soud|mestsky soud)( pro)? /, '');
    const hits = DISTRICT_COURTS.filter(([n]) => foldName(n).replace(/^(okresni soud|obvodni soud|mestsky soud) /, '') === m);
    return hits.length === 1 ? { kind: 'okresni', code: hits[0][1] } : null;
}
export const districtCourtCode = (authority: string): string | null => { const r = courtRef(authority); return r?.kind === 'okresni' ? r.code : null; };

// Přímý odkaz, který v InfoSoudu rovnou vyhledá řízení. Okresní soudy: ročník od 2007, krajské a vyšší: od 2008 (jiné InfoSoud
// nezobrazuje). Vyžaduje senát. Odkaz otevře uživatel sám, vyhledání proběhne v jeho prohlížeči.
export function infosoudDirectLink(fn: FileNumber, authority: string): string | null {
    const ref = courtRef(authority);
    if (!ref || fn.senat === null || fn.rocnik < (ref.kind === 'okresni' ? 2007 : 2008)) return null;
    const q = new URLSearchParams({ typOrganizace: 'VSECHNY_KRAJE', [ref.kind === 'okresni' ? 'okresniSoud' : 'druhOrganizace']: ref.code, cisloSenatu: String(fn.senat), druhVeci: fn.druh.toUpperCase(), bcVec: String(fn.cislo), rocnik: String(fn.rocnik) });
    return `${INFOSOUD_URL}/detail-rizeni?${q.toString()}`;
}

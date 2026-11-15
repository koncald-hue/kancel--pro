// Napojení na bezplatné REST API katastru nemovitostí ČÚZK (https://api-kn.cuzk.gov.cz).
// Ruční vyhledání parcely podle katastrálního území a parcelního čísla. API neposkytuje osobní údaje (vlastníky).
export const CUZK_BASE = 'https://api-kn.cuzk.gov.cz';

export type KatastralniUzemi = { kod: number; nazev: string };
export type ParcelaDruh = 1 | 2; // 1 = stavební parcela, 2 = pozemková parcela
export type Plomba = { typ: string; cislo: string };

export type ParcelaView = {
    id: number;
    oznaceni: string;                // např. "123/4" nebo "st. 56"
    katastralniUzemi: { kod: number; nazev: string };
    typ: 'PKN' | 'PZE';
    stavebni: boolean;
    vymera: number | null;           // m²
    druhPozemku: string;
    zpusobVyuziti: string;
    lv: { cislo: number; katastralniUzemi: string } | null;
    stavba: string | null;           // např. "č. p. 12"
    zpusobyOchrany: string[];
    plomby: Plomba[];                // probíhající řízení (plomby)
    bpej: { kod: number; vymera: number }[];
};

// "123/4" → { kmen: 123, poddeleni: 4 }, "123" → { kmen: 123 }, "st. 56" nebo "st.56/2" → stavební
export function parseParcelNumber(input: string): { kmen: number; poddeleni?: number; druh: ParcelaDruh } | null {
    const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
    const match = text.match(/^(st\.?\s*)?(\d{1,6})(?:\s*\/\s*(\d{1,4}))?$/);
    if (!match) return null;
    const kmen = Number(match[2]);
    if (!Number.isInteger(kmen) || kmen < 1) return null;
    return { kmen, ...(match[3] !== undefined ? { poddeleni: Number(match[3]) } : {}), druh: match[1] ? 1 : 2 };
}

export const parcelLabel = (druh: ParcelaDruh, kmen: number, poddeleni?: number | null) => `${druh === 1 ? 'st. ' : ''}${kmen}${poddeleni ? `/${poddeleni}` : ''}`;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const defName = (v: unknown) => str(obj(v).nazev);

// Zjednodušení odpovědi API (pole „parcela“ z rozhraní) na údaje, které zobrazujeme
export function normalizeParcel(raw: unknown): ParcelaView | null {
    const p = obj(raw);
    const id = num(p.id);
    const ku = obj(p.katastralniUzemi);
    const kmen = num(p.kmenoveCisloParcely);
    if (id === null || kmen === null) return null;
    const stavebni = num(p.druhCislovaniParcely) === 1;
    const lv = obj(p.lv);
    const stavba = obj(p.stavba);
    const domovni = Array.isArray(stavba.cislaDomovni) ? (stavba.cislaDomovni as unknown[]).filter((x) => typeof x === 'number') : [];
    return {
        id,
        oznaceni: parcelLabel(stavebni ? 1 : 2, kmen, num(p.poddeleniCislaParcely)),
        katastralniUzemi: { kod: num(ku.kod) ?? 0, nazev: str(ku.nazev) },
        typ: p.typParcely === 'PZE' ? 'PZE' : 'PKN',
        stavebni,
        vymera: num(p.vymera),
        druhPozemku: defName(p.druhPozemku),
        zpusobVyuziti: defName(p.zpusobVyuziti),
        lv: num(lv.cislo) !== null ? { cislo: num(lv.cislo)!, katastralniUzemi: str(obj(lv.katastralniUzemi).nazev) } : null,
        stavba: Object.keys(stavba).length ? (domovni.length ? `č. p. ${domovni.join(', ')}` : 'stavba') : null,
        zpusobyOchrany: (Array.isArray(p.zpusobyOchrany) ? p.zpusobyOchrany : []).map(defName).filter(Boolean),
        plomby: (Array.isArray(p.rizeniPlomby) ? p.rizeniPlomby : []).map((r) => { const o = obj(r); return { typ: str(o.typRizeni), cislo: `${num(o.poradoveCislo) ?? '?'}/${num(o.rok) ?? '?'}` }; }),
        bpej: (Array.isArray(p.bpej) ? p.bpej : []).map((b) => ({ kod: num(obj(b).kod) ?? 0, vymera: num(obj(b).vymera) ?? 0 })),
    };
}

// Hledání katastrálního území podle názvu nebo kódu (bez diakritiky a velikosti písmen)
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function searchKu(list: KatastralniUzemi[], query: string, limit = 8): KatastralniUzemi[] {
    const q = fold(query);
    if (q.length < 2) return [];
    const exact = list.filter((k) => String(k.kod) === q || fold(k.nazev) === q);
    const starts = list.filter((k) => fold(k.nazev).startsWith(q) && !exact.includes(k));
    const contains = list.filter((k) => fold(k.nazev).includes(q) && !exact.includes(k) && !starts.includes(k));
    return [...exact, ...starts, ...contains].slice(0, limit);
}

export const INFO_DISCLAIMER = 'Údaje jsou informativní, bez právní závaznosti. Pro řízení použijte ověřený výpis z katastru nemovitostí.';

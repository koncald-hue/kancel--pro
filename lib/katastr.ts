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
    mapovyList: string;              // např. "DKM"
    zpusobUrceniVymery: string;
    souradnice: { x: number; y: number } | null; // S-JTSK, definiční bod
    puvodniKu: string;
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
        mapovyList: str(obj(p.mapovyList).oznaceni),
        zpusobUrceniVymery: defName(p.zpusobUrceniVymery),
        souradnice: num(obj(p.definicniBod).x) !== null && num(obj(p.definicniBod).y) !== null ? { x: num(obj(p.definicniBod).x)!, y: num(obj(p.definicniBod).y)! } : null,
        puvodniKu: defName(p.katastralniUzemiPuvodni),
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


// ---------- Stavby, jednotky, řízení ----------
export type NeighborView = { id: number; oznaceni: string; katastralniUzemi: string };
export type StavbaView = {
    id: number; typ: string; cisla: string; castObce: string; lv: { cislo: number; katastralniUzemi: string } | null; zpusobVyuziti: string;
    zpusobyOchrany: string[]; parcely: NeighborView[]; pocetJednotek: number; docasna: boolean; plomby: Plomba[];
};
export type JednotkaView = {
    id: number; cislo: number | null; typ: string; zpusobVyuziti: string; podil: string; lv: { cislo: number; katastralniUzemi: string } | null;
    stavba: string; zpusobyOchrany: string[]; plomby: Plomba[];
};
export type RizeniView = {
    id: number; typ: string; typNazev: string; cislo: string; kodPracoviste: number; datumPrijeti: string; stav: string; stavUhrady: string; navazana: string[]; poznamky: string[];
};
export const RIZENI_TYPY: Record<string, string> = { V: 'Vklad', Z: 'Záznam', PGP: 'Potvrzení geometrického plánu', PD: 'Podací deník', ZPV: 'Pomocné řízení V' };
const UHRADA: Record<string, string> = { O: 'Osvobozeno', U: 'Uhrazeno', N: 'Neuhrazeno' };

const lvOf = (v: unknown) => { const lv = obj(v); return num(lv.cislo) !== null ? { cislo: num(lv.cislo)!, katastralniUzemi: str(obj(lv.katastralniUzemi).nazev) } : null; };
const plombyOf = (v: unknown): Plomba[] => (Array.isArray(v) ? v : []).map((r) => { const o = obj(r); return { typ: str(o.typRizeni), cislo: `${num(o.poradoveCislo) ?? '?'}/${num(o.rok) ?? '?'}` }; });
const namesOf = (v: unknown) => (Array.isArray(v) ? v : []).map(defName).filter(Boolean);

export function normalizeNeighbor(raw: unknown): NeighborView | null {
    const p = obj(raw); const id = num(p.id); const kmen = num(p.kmenoveCisloParcely);
    if (id === null || kmen === null) return null;
    return { id, oznaceni: parcelLabel(num(p.druhCislovaniParcely) === 1 ? 1 : 2, kmen, num(p.poddeleniCislaParcely)), katastralniUzemi: defName(p.katastralniUzemi) };
}

export function normalizeStavba(raw: unknown): StavbaView | null {
    const b = obj(raw); const id = num(b.id);
    if (id === null) return null;
    const domovni = (Array.isArray(b.cislaDomovni) ? b.cislaDomovni : []).filter((x): x is number => typeof x === 'number');
    return {
        id, typ: defName(b.typStavby), cisla: domovni.join(', '), castObce: defName(b.castObce), lv: lvOf(b.lv), zpusobVyuziti: defName(b.zpusobVyuziti), zpusobyOchrany: namesOf(b.zpusobyOchrany),
        parcely: (Array.isArray(b.parcely) ? b.parcely : []).map(normalizeNeighbor).filter((x): x is NeighborView => x !== null), pocetJednotek: Array.isArray(b.jednotky) ? b.jednotky.length : 0, docasna: b.docasna === true, plomby: plombyOf(b.rizeniPlomby),
    };
}

export function normalizeJednotka(raw: unknown): JednotkaView | null {
    const j = obj(raw); const id = num(j.id);
    if (id === null) return null;
    const podil = obj(j.podilNaSpolecnychCastechDomu);
    const stavba = obj(j.vymezenaVeStavbe);
    const domovni = (Array.isArray(stavba.cislaDomovni) ? stavba.cislaDomovni : []).filter((x): x is number => typeof x === 'number');
    return {
        id, cislo: num(j.cisloJednotky), typ: defName(j.typJednotky), zpusobVyuziti: defName(j.zpusobVyuziti),
        podil: num(podil.citatel) !== null && num(podil.jmenovatel) !== null ? `${num(podil.citatel)}/${num(podil.jmenovatel)}` : '',
        lv: lvOf(j.lv), stavba: Object.keys(stavba).length ? `${defName(stavba.typStavby) || 'stavba'}${domovni.length ? ` č. p. ${domovni.join(', ')}` : ''}${defName(stavba.castObce) ? `, ${defName(stavba.castObce)}` : ''}` : '',
        zpusobyOchrany: namesOf(j.zpusobyOchrany), plomby: plombyOf(j.rizeniPlomby),
    };
}

export function normalizeRizeni(raw: unknown): RizeniView | null {
    const r = obj(raw); const id = num(r.id);
    if (id === null) return null;
    const typ = str(r.typRizeni);
    return {
        id, typ, typNazev: RIZENI_TYPY[typ] ?? typ, cislo: `${num(r.poradoveCislo) ?? '?'}/${num(r.rok) ?? '?'}`, kodPracoviste: num(r.kodPracoviste) ?? 0,
        datumPrijeti: str(r.datumPrijeti).slice(0, 10), stav: str(r.stav), stavUhrady: UHRADA[str(r.stavUhrady)] ?? '',
        navazana: (Array.isArray(r.navazanaRizeni) ? r.navazanaRizeni : []).map((x) => { const o = obj(x); return `${RIZENI_TYPY[str(o.typRizeni)] ?? str(o.typRizeni)} ${num(o.poradoveCislo) ?? '?'}/${num(o.rok) ?? '?'}`; }),
        poznamky: (Array.isArray(r.poznamky) ? r.poznamky : []).filter((x): x is string => typeof x === 'string'),
    };
}

// Hledání v číselníku podle názvu (část obce, pracoviště); obec pro zobrazení
export type CastObce = { kod: number; nazev: string; obec: string };
export function searchCastiObce(list: CastObce[], query: string, limit = 8): CastObce[] {
    const q = fold(query);
    if (q.length < 2) return [];
    const exact = list.filter((k) => String(k.kod) === q || fold(k.nazev) === q);
    const starts = list.filter((k) => fold(k.nazev).startsWith(q) && !exact.includes(k));
    const contains = list.filter((k) => (fold(k.nazev).includes(q) || fold(k.obec).includes(q)) && !exact.includes(k) && !starts.includes(k));
    return [...exact, ...starts, ...contains].slice(0, limit);
}

// Uložený snímek: typ + údaje (starší záznamy bez typu jsou parcely)
export type PropertySnapshot = ({ kind: 'parcela' } & ParcelaView) | ({ kind: 'stavba' } & StavbaView) | ({ kind: 'jednotka' } & JednotkaView) | ({ kind: 'rizeni' } & RizeniView);

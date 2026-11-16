import { parseParcelNumber } from './katastr';

// Pomůcky pro mapu katastru: parcely z veřejné INSPIRE služby ČÚZK (WFS) a adresy z RÚIAN.
export type MapParcel = { ref: string; ku: number; kmen: number; poddeleni?: number; druh: 1 | 2; label: string; area: number | null; ring: [number, number][]; holes: [number, number][][] };

export const WFS_URL = 'https://services.cuzk.gov.cz/wfs/inspire-cp-wfs.asp';
export const WMS_URL = 'https://services.cuzk.gov.cz/wms/inspire-cp-wms.asp';
export const RUIAN_ADDRESS_URL = 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/1/query';

// Kód katastrálního území a číslo parcely z označení typu „727024-1152/5“ nebo „727024-st. 12“
export function parseRef(ref: string): { ku: number; kmen: number; poddeleni?: number; druh: 1 | 2 } | null {
    const m = ref.trim().match(/^(\d{4,6})-(.+)$/);
    if (!m) return null;
    const p = parseParcelNumber(m[2]);
    if (!p) return null;
    return { ku: Number(m[1]), kmen: p.kmen, ...(p.poddeleni !== undefined ? { poddeleni: p.poddeleni } : {}), druh: p.druh as 1 | 2 };
}

// Z odpovědi WFS (GML) vybere parcely a jejich vnější obrys; souřadnice v pořadí šířka, délka
export function parseWfsParcels(xml: string): MapParcel[] {
    const out: MapParcel[] = [];
    for (const m of xml.matchAll(/<cp:CadastralParcel\b[\s\S]*?<\/cp:CadastralParcel>/g)) {
        const block = m[0];
        const ref = block.match(/<cp:nationalCadastralReference>([^<]+)</)?.[1]?.trim() ?? '';
        const parsed = parseRef(ref);
        const toPts = (list: string): [number, number][] | null => {
            const n = list.trim().split(/\s+/).map(Number);
            if (n.length < 6 || n.some((v) => !Number.isFinite(v))) return null;
            const pts: [number, number][] = [];
            for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
            return pts;
        };
        const ring = toPts(block.match(/<gml:exterior>[\s\S]*?<gml:posList[^>]*>([^<]+)</)?.[1] ?? '');
        if (!parsed || !ring) continue;
        // Díry: stavební parcela uvnitř pozemku je v pozemku vyříznutá
        const holes = [...block.matchAll(/<gml:interior>[\s\S]*?<gml:posList[^>]*>([^<]+)</g)].map((h) => toPts(h[1])).filter((h): h is [number, number][] => h !== null);
        const area = Number(block.match(/<cp:areaValue[^>]*>([^<]+)</)?.[1]);
        out.push({ ref, ...parsed, label: block.match(/<cp:label>([^<]+)</)?.[1]?.trim() ?? ref, area: Number.isFinite(area) ? area : null, ring, holes });
    }
    return out;
}

// Je bod uvnitř obrysu (paprskový algoritmus)? Obrys má [šířka, délka]
export function pointInRing(lat: number, lon: number, ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [yi, xi] = ring[i]; const [yj, xj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

// Je bod uvnitř parcely: v obrysu a ne v některé z děr
export const pointInParcel = (lat: number, lon: number, p: Pick<MapParcel, 'ring' | 'holes'>) => pointInRing(lat, lon, p.ring) && !p.holes.some((h) => pointInRing(lat, lon, h));

export const wfsPointUrl = (lat: number, lon: number) => {
    const d = 0.00001;
    return `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typenames=CP:CadastralParcel&srsName=urn:ogc:def:crs:EPSG::4326&bbox=${lat - d},${lon - d},${lat + d},${lon + d},urn:ogc:def:crs:EPSG::4326&count=5`;
};

export type AddressHit = { adresa: string; lat: number; lon: number };

// Dotaz na adresní místa RÚIAN podle textu; text se očistí od znaků, které by rozbily dotaz
export function addressWhere(q: string): string | null {
    const words = q.normalize('NFC').replace(/[^\p{L}\p{N}\s./-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
    if (words.join('').length < 3) return null;
    return words.map((w) => `upper(adresa) like '%${w.toUpperCase().replace(/'/g, "''")}%'`).join(' and ');
}

// Dotaz na parcelu podle označení „kód k. ú.-číslo“ (INSPIRE neodlišuje stavební parcely předponou „st.“, proto se vybírá podle výměry)
export const wfsRefUrl = (ref: string) => `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typenames=CP:CadastralParcel&srsName=urn:ogc:def:crs:EPSG::4326&count=5&filter=${encodeURIComponent(`<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>cp:nationalCadastralReference</fes:ValueReference><fes:Literal>${ref.replace(/[^0-9/-]/g, '')}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`)}`;

export function pickByArea(parcels: MapParcel[], area: number | null): MapParcel | undefined {
    if (area !== null) { const exact = parcels.find((p) => p.area !== null && Math.abs(p.area - area) <= 1); if (exact) return exact; }
    return parcels[0];
}

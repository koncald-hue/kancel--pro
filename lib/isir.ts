// Insolvenční rejstřík (ISIR): veřejná webová služba Ministerstva spravedlnosti. Hlídání = pravidelné dotazy na hlídané osoby.
export const ISIR_URL = 'https://isir.justice.cz:8443/isir_cuzk_ws/IsirWsCuzkService';

export type IsirQuery = { kind: 'firma'; ic: string } | { kind: 'osoba'; name: string; firstName: string; birth: string };
export type IsirHit = { spis: string; court: string; debtor: string; state: string; started: string | null; ended: string | null; url: string };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildRequest(q: IsirQuery): string {
    const fields = q.kind === 'firma'
        ? `<ic>${esc(q.ic)}</ic>`
        : `<nazevOsoby>${esc(q.name)}</nazevOsoby><jmeno>${esc(q.firstName)}</jmeno><datumNarozeni>${esc(q.birth)}</datumNarozeni><vyhledatPresnouShoduJmen>T</vyhledatPresnouShoduJmen>`;
    return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://isirws.cca.cz/types/"><soapenv:Header/><soapenv:Body><typ:getIsirWsCuzkDataRequest>${fields}<maxPocetVysledku>20</maxPocetVysledku></typ:getIsirWsCuzkDataRequest></soapenv:Body></soapenv:Envelope>`;
}

const STATES: Record<string, string> = {
    KONKURS: 'Konkurs', REORGANIZ: 'Reorganizace', ODDLUZENI: 'Oddlužení', 'ODDLUŽENÍ': 'Oddlužení', ZAHAJENI: 'Řízení zahájeno', 'MORATORIUM': 'Moratorium',
};
export const stateLabel = (raw: string) => STATES[raw.toUpperCase()] ?? (raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : 'V řízení');

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() ?? '';
const unesc = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export type IsirResult = { ok: true; hits: IsirHit[] } | { ok: false; error: string };

// Zpracuje odpovědi služby; „Prázdný výsledek“ (WS2) znamená, že osoba v rejstříku není
export function parseResponse(xml: string): IsirResult {
    const errCode = tag(xml, 'kodChyby');
    if (errCode === 'WS2') return { ok: true, hits: [] };
    if (errCode) return { ok: false, error: unesc(tag(xml, 'textChyby')) || errCode };
    if (!xml.includes('getIsirWsCuzkDataResponse')) return { ok: false, error: 'Neočekávaná odpověď rejstříku.' };
    const hits: IsirHit[] = [];
    for (const m of xml.matchAll(/<data>([\s\S]*?)<\/data>/g)) {
        const b = m[1];
        const num = tag(b, 'bcVec'); const year = tag(b, 'rocnik');
        if (!num || !year) continue;
        hits.push({
            spis: `${tag(b, 'cisloSenatu')} ${tag(b, 'druhVec')} ${num}/${year}`.trim(),
            court: unesc(tag(b, 'nazevOrganizace')),
            debtor: unesc(tag(b, 'nazevOsoby') || [tag(b, 'jmeno'), tag(b, 'nazevOsoby')].filter(Boolean).join(' ')),
            state: stateLabel(tag(b, 'druhStavKonkursu')),
            started: day(tag(b, 'datumPmZahajeniUpadku')),
            ended: day(tag(b, 'datumPmUkonceniUpadku')),
            url: unesc(tag(b, 'urlDetailRizeni')).startsWith('https://isir.justice.cz/') ? unesc(tag(b, 'urlDetailRizeni')) : '',
        });
    }
    return { ok: true, hits };
}

export async function queryIsir(q: IsirQuery): Promise<IsirResult> {
    try {
        const res = await fetch(ISIR_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' }, body: buildRequest(q), cache: 'no-store', signal: AbortSignal.timeout(25_000) });
        if (!res.ok && res.status >= 500 && !(await res.clone().text()).includes('kodChyby')) return { ok: false, error: 'Insolvenční rejstřík teď neodpovídá.' };
        return parseResponse(await res.text());
    } catch { return { ok: false, error: 'Insolvenční rejstřík teď neodpovídá.' }; }
}

// Co je nového oproti uloženým nálezům: nové spisy a změna stavu u známých
export function diffHits(known: { spis: string; state: string; ended: string | null }[], fresh: IsirHit[]): { added: IsirHit[]; changed: IsirHit[] } {
    const map = new Map(known.map((k) => [k.spis, k]));
    const added: IsirHit[] = []; const changed: IsirHit[] = [];
    for (const h of fresh) {
        const k = map.get(h.spis);
        if (!k) added.push(h);
        else if (k.state !== h.state || (k.ended ?? null) !== (h.ended ?? null)) changed.push(h);
    }
    return { added, changed };
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { RUIAN_ADDRESS_URL, addressWhere, parseWfsParcels, pickByArea, pointInParcel, wfsPointUrl, wfsRefUrl } from '@/lib/katastrMap';
import { CUZK_BASE, RIZENI_TYPY, normalizeJednotka, normalizeNeighbor, normalizeParcel, normalizeRizeni, normalizeStavba, searchCastiObce, searchKu, type CastObce, type KatastralniUzemi } from '@/lib/katastr';
import { mfaBlocked } from '@/lib/serverMfa';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Klíč k API katastru je JEN na serveru. Limity jsou sdílené mezi instancemi.
let kuCache: { at: number; list: KatastralniUzemi[] } | null = null;
let coCache: { at: number; list: CastObce[] } | null = null;
let wsCache: { at: number; list: { kod: number; nazev: string }[] } | null = null;
const DAY = 24 * 60 * 60 * 1000;

async function cuzk(path: string, apiKey: string): Promise<Response> {
    return fetch(`${CUZK_BASE}${path}`, { headers: { ApiKey: apiKey, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
}

async function loadKu(apiKey: string): Promise<KatastralniUzemi[] | null> {
    if (kuCache && Date.now() - kuCache.at < DAY) return kuCache.list;
    const res = await cuzk('/api/v1/CiselnikyUzemnichJednotek/KatastralniUzemi', apiKey);
    if (!res.ok) return null;
    const body = await res.json() as { data?: { kod?: number; nazev?: string; platnostDo?: string | null }[] };
    const list = (body.data ?? []).filter((k) => typeof k.kod === 'number' && typeof k.nazev === 'string' && !k.platnostDo).map((k) => ({ kod: k.kod as number, nazev: k.nazev as string }));
    if (list.length) kuCache = { at: Date.now(), list };
    return list;
}

type Row = { kod?: number; nazev?: string; kodObce?: number; platnostDo?: string | null };
async function loadList(path: string, apiKey: string): Promise<Row[] | null> {
    const res = await cuzk(path, apiKey);
    if (!res.ok) return null;
    const body = await res.json() as { data?: Row[] };
    return (body.data ?? []).filter((k) => typeof k.kod === 'number' && typeof k.nazev === 'string' && !k.platnostDo);
}

// Části obcí s názvem obce (dva číselníky, načtou se jednou denně)
async function loadCastiObce(apiKey: string): Promise<CastObce[] | null> {
    if (coCache && Date.now() - coCache.at < DAY) return coCache.list;
    const [parts, towns] = await Promise.all([loadList('/api/v1/CiselnikyUzemnichJednotek/CastiObci', apiKey), loadList('/api/v1/CiselnikyUzemnichJednotek/Obce', apiKey)]);
    if (!parts) return null;
    const townName = new Map((towns ?? []).map((t) => [t.kod as number, t.nazev as string]));
    const list = parts.map((c) => ({ kod: c.kod as number, nazev: c.nazev as string, obec: townName.get(c.kodObce ?? -1) ?? '' }));
    if (list.length) coCache = { at: Date.now(), list };
    return list;
}

async function loadPracoviste(apiKey: string) {
    if (wsCache && Date.now() - wsCache.at < DAY) return wsCache.list;
    const list = await loadList('/api/v1/CiselnikyISKN/Pracoviste', apiKey);
    if (!list) return null;
    const out = list.map((p) => ({ kod: p.kod as number, nazev: p.nazev as string })).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    if (out.length) wsCache = { at: Date.now(), list: out };
    return out;
}

const int = (v: string | null, min: number, max: number): number | null => { if (v === null || v === '') return null; const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };

// Společné vyřízení odpovědi z ČÚZK (chyby, nenalezeno)
async function upstream(res: Response): Promise<{ error: NextResponse } | { body: { data?: unknown; aktualnostDatK?: string | null } } | { notFound: true }> {
    if (res.status === 404) return { notFound: true };
    if (res.status === 401 || res.status === 403) { console.error('[katastr] ČÚZK odmítlo klíč', res.status); return { error: NextResponse.json({ error: 'upstream_auth' }, { status: 502 }) }; }
    if (res.status === 429) return { error: NextResponse.json({ error: 'upstream_rate' }, { status: 503 }) };
    if (!res.ok) return { error: NextResponse.json({ error: 'upstream' }, { status: 502 }) };
    return { body: await res.json() as { data?: unknown; aktualnostDatK?: string | null } };
}

export async function GET(req: Request) {
    try {
        const apiKey = process.env.CUZK_API_KEY?.trim();
        if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

        // Smí jen přihlášený advokát s vyplněným profilem a platným přístupem (nebo člen týmu)
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
        const { data: userData, error: userError } = await client.auth.getUser(token);
        if (userError || !userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        if (mfaBlocked(userData.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
        const uid = userData.user.id;
        const { data: staff } = await client.rpc('is_staff');
        if (staff !== true) {
            const { data: access } = await client.from('lawyer_access').select('status, until, verification_status').eq('user_id', uid).maybeSingle();
            const today = new Date().toISOString().slice(0, 10);
            const ok = !!access && access.verification_status === 'verified' && (access.status === 'active' || access.status === 'trial') && (!access.until || String(access.until) >= today);
            if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }
        const url = new URL(req.url);

        // Mapa: parcela podle bodu a hledání adresy používají veřejné služby ČÚZK bez klíče, proto se nezapočítávají do denního limitu API
        const mapOp = url.searchParams.get('op');
        if (mapOp === 'bod' || mapOp === 'adresa' || mapOp === 'obrys') {
            if (await rateLimited(`mm:${uid}`, 40, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
            try {
                if (mapOp === 'bod') {
                    const lat = Number(url.searchParams.get('lat')); const lon = Number(url.searchParams.get('lon'));
                    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 48 || lat > 51.2 || lon < 12 || lon > 18.9) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
                    const res = await fetch(wfsPointUrl(lat, lon), { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
                    if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
                    const hit = parseWfsParcels(await res.text()).filter((p) => pointInParcel(lat, lon, p)).sort((a, b) => (a.area ?? Infinity) - (b.area ?? Infinity))[0];
                    return NextResponse.json(hit ? { found: true, parcel: hit } : { found: false });
                }
                if (mapOp === 'obrys') {
                    const ku = int(url.searchParams.get('ku'), 1, 999999); const kmen = int(url.searchParams.get('kmen'), 1, 999999);
                    const podd = url.searchParams.get('podd') ? int(url.searchParams.get('podd'), 0, 9999) : null;
                    const area = url.searchParams.get('area') ? Number(url.searchParams.get('area')) : null;
                    if (ku === null || kmen === null) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
                    const res = await fetch(wfsRefUrl(`${ku}-${kmen}${podd ? `/${podd}` : ''}`), { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
                    if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
                    const hit = pickByArea(parseWfsParcels(await res.text()), area !== null && Number.isFinite(area) ? area : null);
                    return NextResponse.json(hit ? { found: true, parcel: hit } : { found: false });
                }
                const where = addressWhere(url.searchParams.get('q') ?? '');
                if (!where) return NextResponse.json({ results: [] });
                const q = new URLSearchParams({ where, outFields: 'adresa', returnGeometry: 'true', outSR: '4326', resultRecordCount: '8', f: 'json' });
                const res = await fetch(`${RUIAN_ADDRESS_URL}?${q}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
                if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
                const body = await res.json() as { features?: { attributes?: { adresa?: string }; geometry?: { x?: number; y?: number } }[] };
                const results = (body.features ?? []).flatMap((f) => (typeof f.attributes?.adresa === 'string' && typeof f.geometry?.x === 'number' && typeof f.geometry?.y === 'number' ? [{ adresa: f.attributes.adresa, lat: f.geometry.y, lon: f.geometry.x }] : []));
                return NextResponse.json({ results });
            } catch { return NextResponse.json({ error: 'upstream' }, { status: 502 }); }
        }

        if (await rateLimited(`m:${uid}`, 10, 60_000) || await rateLimited(`d:${uid}`, 60, 86_400_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
        const op = url.searchParams.get('op');

        if (op === 'ku') {
            const list = await loadKu(apiKey);
            if (!list) return NextResponse.json({ error: 'upstream' }, { status: 502 });
            return NextResponse.json({ results: searchKu(list, url.searchParams.get('q') ?? '') });
        }

        if (op === 'parcela') {
            const ku = Number(url.searchParams.get('ku'));
            const kmen = Number(url.searchParams.get('kmen'));
            const druh = url.searchParams.get('druh') === '1' ? 1 : 2;
            const poddRaw = url.searchParams.get('podd');
            const podd = poddRaw ? Number(poddRaw) : null;
            if (!Number.isInteger(ku) || ku < 1 || ku > 999999 || !Number.isInteger(kmen) || kmen < 1 || kmen > 999999 || (podd !== null && (!Number.isInteger(podd) || podd < 0 || podd > 9999))) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            const typParcely = url.searchParams.get('evid') === 'PZE' ? 'PZE' : 'PKN';
            const q = new URLSearchParams({ KodKatastralnihoUzemi: String(ku), TypParcely: typParcely, DruhCislovaniParcely: String(druh), KmenoveCisloParcely: String(kmen) });
            if (podd !== null && podd > 0) q.set('PoddeleniCislaParcely', String(podd));
            const res = await cuzk(`/api/v1/Parcely/Vyhledani?${q}`, apiKey);
            if (res.status === 404) return NextResponse.json({ found: false });
            if (res.status === 401 || res.status === 403) { console.error('[katastr] ČÚZK odmítlo klíč', res.status); return NextResponse.json({ error: 'upstream_auth' }, { status: 502 }); }
            if (res.status === 429) return NextResponse.json({ error: 'upstream_rate' }, { status: 503 });
            if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
            const body = await res.json() as { data?: unknown[]; aktualnostDatK?: string | null };
            const parcels = (body.data ?? []).map(normalizeParcel).filter((p) => p !== null);
            return NextResponse.json({ found: parcels.length > 0, parcels, aktualnostDatK: body.aktualnostDatK ?? null });
        }

        if (op === 'castiobce') {
            const list = await loadCastiObce(apiKey);
            if (!list) return NextResponse.json({ error: 'upstream' }, { status: 502 });
            return NextResponse.json({ results: searchCastiObce(list, url.searchParams.get('q') ?? '') });
        }

        if (op === 'pracoviste') {
            const list = await loadPracoviste(apiKey);
            if (!list) return NextResponse.json({ error: 'upstream' }, { status: 502 });
            return NextResponse.json({ results: list });
        }

        if (op === 'sousedni' || op === 'parcelaId') {
            const id = url.searchParams.get('id') ?? '';
            if (!/^\d{1,15}$/.test(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            const r = await upstream(await cuzk(op === 'sousedni' ? `/api/v1/Parcely/SousedniParcely/${id}` : `/api/v1/Parcely/${id}`, apiKey));
            if ('error' in r) return r.error;
            if ('notFound' in r) return NextResponse.json({ found: false });
            if (op === 'sousedni') { const neighbors = ((r.body.data as unknown[]) ?? []).map(normalizeNeighbor).filter((x) => x !== null); return NextResponse.json({ found: true, neighbors }); }
            const parcel = normalizeParcel(r.body.data);
            return NextResponse.json({ found: !!parcel, parcels: parcel ? [parcel] : [], aktualnostDatK: r.body.aktualnostDatK ?? null });
        }

        if (op === 'stavba' || op === 'jednotka') {
            const co = int(url.searchParams.get('co'), 1, 99999999);
            const typ = int(url.searchParams.get('typ'), 1, 2);
            const cp = int(url.searchParams.get('cp'), 1, 99999);
            const cj = op === 'jednotka' ? int(url.searchParams.get('cj'), 1, 99999) : 0;
            if (co === null || typ === null || cp === null || cj === null) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            const q = new URLSearchParams({ KodCastiObce: String(co), TypStavby: String(typ), CisloDomovni: String(cp) });
            if (op === 'jednotka') q.set('CisloJednotky', String(cj));
            const r = await upstream(await cuzk(`/api/v1/${op === 'stavba' ? 'Stavby' : 'Jednotky'}/Vyhledani?${q}`, apiKey));
            if ('error' in r) return r.error;
            if ('notFound' in r) return NextResponse.json({ found: false });
            const raw = (r.body.data as unknown[]) ?? [];
            const items = (op === 'stavba' ? raw.map(normalizeStavba) : raw.map(normalizeJednotka)).filter((x) => x !== null);
            return NextResponse.json({ found: items.length > 0, items, aktualnostDatK: r.body.aktualnostDatK ?? null });
        }

        if (op === 'rizeni') {
            // Hlídání řízení (zavolá ho aplikace sama): společný denní rozpočet, aby hlídání nespotřebovalo limit klíče ČÚZK určený pro ruční hledání
            if (url.searchParams.get('watch') === '1' && await rateLimited('cuzk-watch-day', 300, 24 * 60 * 60_000)) return NextResponse.json({ error: 'budget' }, { status: 429 });
            const typ = url.searchParams.get('typ') ?? '';
            const cislo = int(url.searchParams.get('cislo'), 1, 99999999);
            const rok = int(url.searchParams.get('rok'), 1990, 2100);
            const ws = int(url.searchParams.get('ws'), 1, 99999);
            if (!(typ in RIZENI_TYPY) || cislo === null || rok === null || ws === null) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            const q = new URLSearchParams({ TypRizeni: typ, Cislo: String(cislo), Rok: String(rok), KodPracoviste: String(ws) });
            const r = await upstream(await cuzk(`/api/v1/Rizeni/Vyhledani?${q}`, apiKey));
            if ('error' in r) return r.error;
            if ('notFound' in r) return NextResponse.json({ found: false });
            const items = ((r.body.data as unknown[]) ?? []).map(normalizeRizeni).filter((x) => x !== null);
            return NextResponse.json({ found: items.length > 0, items, aktualnostDatK: r.body.aktualnostDatK ?? null });
        }

        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    } catch (err) {
        console.error('[katastr]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'upstream' }, { status: 502 });
    }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CUZK_BASE, normalizeParcel, searchKu, type KatastralniUzemi } from '@/lib/katastr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Klíč k API katastru je JEN na serveru (podmínky ČÚZK zakazují jeho předání koncovému zařízení).
// Počet volání ČÚZK je omezený pro celý klíč (bezplatný klíč: 500 volání za den), proto limity na uživatele (počítadlo je jen v paměti serveru).
const hits = new Map<string, { count: number; resetAt: number }>();
function limited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    if (hits.size > 3000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) { hits.set(key, { count: 1, resetAt: now + windowMs }); return false; }
    entry.count += 1;
    return entry.count > limit;
}

let kuCache: { at: number; list: KatastralniUzemi[] } | null = null;
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
        const uid = userData.user.id;
        const { data: staff } = await client.rpc('is_staff');
        if (staff !== true) {
            const { data: access } = await client.from('lawyer_access').select('status, until, verification_status').eq('user_id', uid).maybeSingle();
            const today = new Date().toISOString().slice(0, 10);
            const ok = !!access && access.verification_status === 'verified' && (access.status === 'active' || access.status === 'trial') && (!access.until || String(access.until) >= today);
            if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }
        if (limited(`m:${uid}`, 10, 60_000) || limited(`d:${uid}`, 60, 86_400_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

        const url = new URL(req.url);
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
            const q = new URLSearchParams({ KodKatastralnihoUzemi: String(ku), TypParcely: 'PKN', DruhCislovaniParcely: String(druh), KmenoveCisloParcely: String(kmen) });
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

        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    } catch (err) {
        console.error('[katastr]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'upstream' }, { status: 502 });
    }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { ARES_BASE, cleanIco, isSearchableName, isValidIco, normalizeCompany, type AresCompany } from '@/lib/ares';
import { mfaBlocked } from '@/lib/serverMfa';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Vyhledání firmy v ARES podle IČO (jedna firma) nebo podle názvu (až 8 výsledků). Smí jen přihlášený uživatel.
export async function GET(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(userData.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`ares:${userData.user.id}`, 40, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    try {
        const digits = cleanIco(q);
        if (/^\d{8}$/.test(digits)) {
            if (!isValidIco(digits)) return NextResponse.json({ results: [], note: 'IČO nemá platný kontrolní součet.' });
            const res = await fetch(`${ARES_BASE}/${digits}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
            if (res.status === 404) return NextResponse.json({ results: [] });
            if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
            const c = normalizeCompany(await res.json());
            return NextResponse.json({ results: c ? [c] : [] });
        }
        if (!isSearchableName(q)) return NextResponse.json({ results: [] });
        const res = await fetch(`${ARES_BASE}/vyhledat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ obchodniJmeno: q, start: 0, pocet: 8 }), cache: 'no-store', signal: AbortSignal.timeout(12_000) });
        if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
        const body = await res.json() as { ekonomickeSubjekty?: unknown[] };
        const results = (body.ekonomickeSubjekty ?? []).map(normalizeCompany).filter((c): c is AresCompany => c !== null);
        return NextResponse.json({ results });
    } catch { return NextResponse.json({ error: 'upstream' }, { status: 502 }); }
}

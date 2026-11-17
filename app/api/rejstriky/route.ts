import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ARES_BASE, cleanIco, isValidIco, normalizeCompany } from '@/lib/ares';
import { normalizeRzp, normalizeVr } from '@/lib/registers';
import { rateLimited } from '@/lib/serverSupabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const get = (url: string) => fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(12_000) });

// Údaje o subjektu z ARES: základ, obchodní rejstřík a živnostenský rejstřík. Smí jen přihlášený uživatel.
export async function GET(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (await rateLimited(`reg:${u.user.id}`, 30, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

    const ico = cleanIco(new URL(req.url).searchParams.get('ico') ?? '');
    if (!/^\d{8}$/.test(ico) || !isValidIco(ico)) return NextResponse.json({ error: 'invalid', message: 'IČO nemá platný tvar.' }, { status: 400 });
    try {
        const [base, vr, rzp] = await Promise.all([get(`${ARES_BASE}/${ico}`), get(`${ARES_BASE}-vr/${ico}`), get(`${ARES_BASE}-rzp/${ico}`)]);
        if (base.status === 404) return NextResponse.json({ error: 'notfound' }, { status: 404 });
        if (!base.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
        const b = await base.json() as Record<string, unknown>;
        return NextResponse.json({
            company: normalizeCompany(b), form: String(b.pravniForma ?? ''), founded: String(b.datumVzniku ?? '').slice(0, 10),
            vr: vr.ok ? normalizeVr(await vr.json().catch(() => null)) : null,
            rzp: rzp.ok ? normalizeRzp(await rzp.json().catch(() => null)) : null,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch { return NextResponse.json({ error: 'upstream' }, { status: 502 }); }
}

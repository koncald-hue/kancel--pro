import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';
import { isValidIco } from '@/lib/ares';
import { queryIsir, type IsirQuery } from '@/lib/isir';
import { checkWatch, type WatchRow } from '@/lib/isirCheck';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Hlídání insolvenčního rejstříku: jednorázové zjištění a kontrola hlídaných osob. Jen s aktivním příplatkem.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error: ue } = await user.auth.getUser(token);
    if (ue || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (rateLimited(`isir:${u.user.id}`, 12, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_isir');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const action = body?.action;

    if (action === 'lookup') {
        let q: IsirQuery;
        if (body?.kind === 'firma') {
            const ic = clean(body.ic, 12).replace(/\s+/g, '');
            if (!isValidIco(ic)) return NextResponse.json({ error: 'bad_request', message: 'IČO nemá platný tvar.' }, { status: 400 });
            q = { kind: 'firma', ic };
        } else {
            const name = clean(body?.name, 80); const firstName = clean(body?.firstName, 80); const birth = clean(body?.birth, 10);
            if (name.length < 2 || firstName.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return NextResponse.json({ error: 'bad_request', message: 'Zadejte jméno, příjmení a datum narození.' }, { status: 400 });
            q = { kind: 'osoba', name, firstName, birth };
        }
        const res = await queryIsir(q);
        return res.ok ? NextResponse.json({ hits: res.hits }) : NextResponse.json({ error: 'upstream', message: res.error }, { status: 502 });
    }

    if (action === 'check') {
        // Klienti s IČO se nejdřív doplní mezi hlídané (pro nově aktivovaný příplatek nebo nové klienty)
        await user.rpc('sync_client_watches');
        const db = serviceClient();
        if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
        let query = db.from('isir_watches').select('id, user_id, kind, ic, name, first_name, birth').eq('user_id', u.user.id).order('last_checked_at', { ascending: true, nullsFirst: true }).limit(50);
        const one = clean(body?.watchId, 60);
        if (one) query = query.eq('id', one);
        const { data: watches } = await query;
        let added = 0; let changed = 0; const errors: string[] = [];
        for (const w of (watches ?? []) as WatchRow[]) {
            const r = await checkWatch(db, w);
            added += r.added; changed += r.changed; if (r.error) errors.push(r.error);
        }
        return NextResponse.json({ checked: (watches ?? []).length, added, changed, errors: [...new Set(errors)] });
    }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}

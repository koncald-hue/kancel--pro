import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serviceClient } from '@/lib/serverSupabase';
import { mfaBlocked } from '@/lib/serverMfa';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Kde lidé odpadají: jen POČTY lidí, kteří došli do dané fáze (za posledních 60 dní od registrace). Obsah spisů se nečte.
export async function GET(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await client.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    const { data: staff } = await client.rpc('is_staff');
    if (staff !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const { data: la } = await db.from('lawyer_access').select('user_id, email, created_at, status, verification_status').gte('created_at', since).limit(5000);
    const users = (la ?? []) as { user_id: string; email: string; created_at: string; status: string; verification_status?: string }[];
    const ids = new Set(users.map((x) => x.user_id));
    const distinct = async (table: string): Promise<Set<string> | null> => {
        const r = await db.from(table).select('user_id').in('user_id', [...ids]).limit(20000);
        if (r.error) return null;
        return new Set((r.data as { user_id: string }[]).map((x) => x.user_id));
    };
    const [cases, clients, links, time, signs] = await Promise.all(['cases', 'lawyer_clients', 'client_links', 'time_entries', 'signature_requests'].map(distinct));
    const n = (s: Set<string> | null) => (s ? s.size : null);
    // Kdo se zaregistroval před aspoň dvěma dny a zatím nezaložil spis ani klienta: komu stojí za to napsat
    const dayMs = 86_400_000;
    const stale = users
        .filter((x) => x.email && Date.now() - new Date(x.created_at).getTime() >= 2 * dayMs && x.status === 'trial' && !(cases?.has(x.user_id)) && !(clients?.has(x.user_id)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
        .map((x) => ({ email: x.email, days: Math.floor((Date.now() - new Date(x.created_at).getTime()) / dayMs) }));
    return NextResponse.json({
        stages: [
            { key: 'registered', label: 'Zaregistrovali se', n: users.length },
            { key: 'profile', label: 'Vyplnili a ověřili profil', n: users.filter((x) => x.verification_status === 'verified').length },
            { key: 'case', label: 'Založili spis', n: n(cases) },
            { key: 'client', label: 'Přidali klienta', n: n(clients) },
            { key: 'link', label: 'Poslali klientovi odkaz', n: n(links) },
            { key: 'time', label: 'Zapsali čas', n: n(time) },
            { key: 'sign', label: 'Poslali dokument k podpisu', n: n(signs) },
            { key: 'paid', label: 'Platí', n: users.filter((x) => x.status === 'active').length },
        ],
        stale,
    });
}

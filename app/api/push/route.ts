import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIp, rateLimited } from '@/lib/serverSupabase';
import { mfaBlocked } from '@/lib/serverMfa';
import { parseSubscription } from '@/lib/push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Zapnutí a vypnutí upozornění na tomto zařízení. Čte a zapisuje se přes přihlášeného uživatele, takže pravidla databáze (RLS) zaručí, že každý mění jen své odběry.
async function authed(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const db = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user || mfaBlocked(data.user, token)) return null;
    if (await rateLimited(`push:${data.user.id}`, 30, 60 * 60_000) || await rateLimited(`push-ip:${clientIp(req)}`, 60, 60 * 60_000)) return 'rate' as const;
    return { db, user: data.user };
}
const h = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
    const a = await authed(req);
    if (a === 'rate') return NextResponse.json({ error: 'rate' }, { status: 429, headers: h });
    if (!a) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: h });
    const { data: allowed } = await a.db.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: h });
    const sub = parseSubscription(await req.json().catch(() => null));
    if (!sub) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: h });
    // Stejné zařízení se může přihlásit jiným účtem: starý odběr se nahradí (adresa je jedinečná)
    await a.db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    const { error } = await a.db.from('push_subscriptions').insert({ user_id: a.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
    if (error) return NextResponse.json({ error: /push_subscriptions|schema cache|does not exist/i.test(error.message) ? 'not_migrated' : 'failed' }, { status: 503, headers: h });
    return NextResponse.json({ ok: true }, { headers: h });
}

export async function DELETE(req: Request) {
    const a = await authed(req);
    if (a === 'rate') return NextResponse.json({ error: 'rate' }, { status: 429, headers: h });
    if (!a) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: h });
    const body = await req.json().catch(() => null) as { endpoint?: unknown } | null;
    if (typeof body?.endpoint !== 'string' || body.endpoint.length > 1000) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: h });
    await a.db.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', a.user.id);
    return NextResponse.json({ ok: true }, { headers: h });
}

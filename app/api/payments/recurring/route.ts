import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';

// Zrušení automatického obnovování přihlášeným uživatelem. Zaplacené období běží dál do konce, další se už nestrhne.
export async function DELETE(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder', { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (await rateLimited(`recur:${u.user.id}`, 10, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const { error: e } = await db.from('lawyer_recurring').update({ active: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', u.user.id);
    return e ? NextResponse.json({ error: 'failed' }, { status: 500 }) : NextResponse.json({ ok: true });
}

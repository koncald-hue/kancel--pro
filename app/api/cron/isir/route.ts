import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { checkWatch, type WatchRow } from '@/lib/isirCheck';

// Porovnání v konstantním čase (délka i obsah se porovnávají přes otisk)
const sameSecret = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Pravidelná kontrola hlídaných osob (volá plánovač hostingu jednou denně s hlavičkou Authorization: Bearer <CRON_SECRET>).
// Zpracuje nejdéle nekontrolované položky a jen těm uživatelům, kteří mají aktivní příplatek.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    // Uživatelé s aktivním příplatkem (vlastním i z kanceláře): klienti s IČO se jim doplní mezi hlídané
    const today = new Date().toISOString().slice(0, 10);
    const [own, firms] = await Promise.all([db.from('lawyer_access').select('user_id').gte('isir_until', today), db.from('firms').select('id').gte('isir_until', today)]);
    const members = (firms.data ?? []).length ? await db.from('firm_members').select('user_id').in('firm_id', (firms.data ?? []).map((f: { id: string }) => f.id)) : { data: [] };
    const users = new Set([...(own.data ?? []), ...(members.data ?? [])].map((r: { user_id: string }) => r.user_id));
    for (const uid of users) await db.rpc('sync_client_watches', { p_user: uid });
    const { data: watches } = await db.from('isir_watches').select('id, user_id, kind, ic, name, first_name, birth').order('last_checked_at', { ascending: true, nullsFirst: true }).limit(80);
    const entitled = new Map<string, boolean>();
    let checked = 0; let added = 0; let changed = 0;
    for (const w of (watches ?? []) as WatchRow[]) {
        if (!entitled.has(w.user_id)) { const { data } = await db.rpc('has_isir', { p_user: w.user_id }); entitled.set(w.user_id, data === true); }
        if (!entitled.get(w.user_id)) continue;
        const r = await checkWatch(db, w);
        checked += 1; added += r.added; changed += r.changed;
    }
    return NextResponse.json({ checked, added, changed });
}

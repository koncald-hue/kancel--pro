import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { checkWatch, type WatchRow } from '@/lib/isirCheck';

// Pravidelná kontrola hlídaných osob (volá plánovač hostingu jednou denně s hlavičkou Authorization: Bearer <CRON_SECRET>).
// Zpracuje nejdéle nekontrolované položky a jen těm uživatelům, kteří mají aktivní příplatek.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
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

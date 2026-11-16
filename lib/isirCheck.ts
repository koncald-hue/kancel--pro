import type { SupabaseClient } from '@supabase/supabase-js';
import { diffHits, queryIsir, type IsirQuery } from './isir';

export type WatchRow = { id: string; user_id: string; kind: 'firma' | 'osoba'; ic: string; name: string; first_name: string; birth: string | null };

export const watchQuery = (w: WatchRow): IsirQuery | null =>
    w.kind === 'firma' ? (w.ic ? { kind: 'firma', ic: w.ic } : null) : (w.birth ? { kind: 'osoba', name: w.name, firstName: w.first_name, birth: w.birth } : null);

// Zkontroluje jednu hlídanou osobu, uloží nové a změněné nálezy. Volá se jen na serveru s právy služby.
export async function checkWatch(db: SupabaseClient, w: WatchRow): Promise<{ added: number; changed: number; error: string }> {
    const q = watchQuery(w);
    const now = new Date().toISOString();
    if (!q) return { added: 0, changed: 0, error: 'Neúplné údaje.' };
    const res = await queryIsir(q);
    if (!res.ok) { await db.from('isir_watches').update({ last_error: res.error, last_checked_at: now }).eq('id', w.id); return { added: 0, changed: 0, error: res.error }; }
    const { data: known } = await db.from('isir_hits').select('spis, state, ended').eq('watch_id', w.id);
    const { added, changed } = diffHits((known ?? []) as { spis: string; state: string; ended: string | null }[], res.hits);
    const row = (h: (typeof res.hits)[number]) => ({ watch_id: w.id, user_id: w.user_id, spis: h.spis, court: h.court, debtor: h.debtor, state: h.state, started: h.started, ended: h.ended, url: h.url });
    if (added.length) await db.from('isir_hits').insert(added.map((h) => ({ ...row(h), seen: false })));
    for (const h of changed) await db.from('isir_hits').update({ ...row(h), seen: false, changed_at: now }).eq('watch_id', w.id).eq('spis', h.spis);
    await db.from('isir_watches').update({ last_error: '', last_checked_at: now }).eq('id', w.id);
    return { added: added.length, changed: changed.length, error: '' };
}

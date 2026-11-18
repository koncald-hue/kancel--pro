import { supabase } from './supabase';
import { dueForCheck } from './radar';
import { autoSyncRadar } from './radarSync';
import { rizeniChange, rizeniQuery } from './hlidac';
import type { RizeniView } from './katastr';

type Watched = { id: string; case_id: string; user_id: string; label: string; snapshot: { kind?: string } & Partial<RizeniView>; watch_checked_at: string | null };

// Kontrola hlídaných řízení v katastru z prohlížeče advokáta: nejvýše jednou za 12 hodin na řízení a nejvýše 10 řízení za spuštění.
// Rozhraní ČÚZK má denní limit pro celý klíč, proto server navíc drží společný denní rozpočet na hlídání (429 = rozpočet vyčerpán).
// Změna stavu se zapíše do radaru a do chronologie věci; uložený snímek se aktualizuje.
let running: Promise<number> | null = null;
export function autoSyncKatastr(force = false): Promise<number> {
    running ??= (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user.id; const token = session?.access_token;
        if (!uid || !token) return 0;
        const { data, error } = await supabase.from('case_properties').select('id, case_id, user_id, label, snapshot, watch_checked_at').eq('watch', true).eq('user_id', uid);
        if (error || !data?.length) return 0;
        const due = (data as Watched[]).filter((w) => w.snapshot?.kind === 'rizeni' && (force || dueForCheck(w.watch_checked_at))).slice(0, 10);
        let found = 0;
        for (const w of due) {
            const snap = w.snapshot as unknown as RizeniView; const q = rizeniQuery(snap);
            const now = new Date().toISOString();
            if (!q) { await supabase.from('case_properties').update({ watch_checked_at: now, watch_error: 'U uloženého řízení chybí údaje pro kontrolu. Uložte ho znovu.' }).eq('id', w.id); continue; }
            const res = await fetch(`/api/katastr?${new URLSearchParams({ op: 'rizeni', typ: q.typ, cislo: String(q.cislo), rok: String(q.rok), ws: String(q.ws), watch: '1' })}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
            if (!res) continue;
            if (res.status === 429) break; // vyčerpaný limit: zbytek až příště
            if (!res.ok) { await supabase.from('case_properties').update({ watch_checked_at: now, watch_error: res.status === 503 ? 'Katastr není na serveru nastavený.' : 'Katastr teď neodpověděl.' }).eq('id', w.id); continue; }
            const body = await res.json().catch(() => ({})) as { found?: boolean; items?: RizeniView[] };
            const cur = body.items?.find((x) => x.id === snap.id) ?? body.items?.[0];
            if (!body.found || !cur) { await supabase.from('case_properties').update({ watch_checked_at: now, watch_error: 'Řízení se v katastru nepodařilo najít.' }).eq('id', w.id); continue; }
            const change = rizeniChange(snap, cur);
            if (change) {
                const { data: added } = await supabase.from('radar_events').upsert({ ...change, kind: 'katastr_rizeni', user_id: uid, case_id: w.case_id, contact_id: null, url: '', event_date: now.slice(0, 10) }, { onConflict: 'case_id,kind,ref', ignoreDuplicates: true }).select('title, detail');
                if (added?.length) {
                    await supabase.from('case_entries').insert({ case_id: w.case_id, user_id: uid, kind: 'event', title: `Hlídač: ${change.title}`.slice(0, 200), body: change.detail, happened_on: now.slice(0, 10) });
                    found += 1;
                }
                await supabase.from('case_properties').update({ snapshot: { kind: 'rizeni', ...cur }, label: `${cur.typNazev || cur.typ} ${cur.cislo}`.slice(0, 200), watch_checked_at: now, watch_error: '' }).eq('id', w.id);
            } else {
                await supabase.from('case_properties').update({ watch_checked_at: now, watch_error: '' }).eq('id', w.id);
            }
        }
        if (found) window.dispatchEvent(new CustomEvent('radar-sync', { detail: found }));
        return found;
    })().catch(() => 0).finally(() => { running = null; });
    return running;
}

// Všechno, co Hlídač hlídá sám: protistrany v ARES a řízení v katastru
export async function syncHlidac(force = false): Promise<number> {
    const [a, k] = await Promise.all([autoSyncRadar(force), autoSyncKatastr(force)]);
    return a + k;
}

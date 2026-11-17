import { supabase } from './supabase';
import { aresChanges, dueForCheck, type Snapshot } from './radar';
import type { AresCompany } from './ares';

type Contact = { id: string; case_id: string; user_id: string; name: string; ico: string };
type SnapRow = { contact_id: string; name: string; address: string; ended: string | null; checked_at: string };

// Kontrola hlídaných firem v ARES z prohlížeče advokáta: nejvýše jednou za 12 hodin na firmu a nejvýše 25 firem za jedno spuštění.
// Nové události se zapíší do radaru a do chronologie věci. Kontroluje jen vlastník kontaktu.
let running: Promise<number> | null = null;
export function autoSyncRadar(force = false): Promise<number> {
    running ??= (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user.id; const token = session?.access_token;
        if (!uid || !token) return 0;
        const { data: contacts, error } = await supabase.from('case_contacts').select('id, case_id, user_id, name, ico').eq('watch', true).eq('user_id', uid).neq('ico', '');
        if (error || !contacts?.length) return 0;
        const ids = (contacts as Contact[]).map((c) => c.id);
        const { data: snaps } = await supabase.from('radar_snapshots').select('contact_id, name, address, ended, checked_at').in('contact_id', ids);
        const byId = new Map(((snaps ?? []) as SnapRow[]).map((s) => [s.contact_id, s]));
        const due = (contacts as Contact[]).filter((c) => force || dueForCheck(byId.get(c.id)?.checked_at)).slice(0, 25);
        let found = 0;
        for (const c of due) {
            const res = await fetch(`/api/ares?q=${encodeURIComponent(c.ico)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
            const now = new Date().toISOString();
            if (!res || !res.ok) { if (res?.status === 429) break; continue; }
            const body = await res.json().catch(() => ({})) as { results?: AresCompany[] };
            const company = body.results?.[0];
            if (!company) { await supabase.from('radar_snapshots').upsert({ contact_id: c.id, user_id: uid, ico: c.ico, checked_at: now, last_error: 'IČO v ARES nenalezeno.' }); continue; }
            const prev = byId.get(c.id);
            const cur: Snapshot = { name: company.name, address: company.address, ended: company.ended ?? null };
            const drafts = aresChanges(prev && prev.name ? { name: prev.name, address: prev.address, ended: prev.ended } : null, cur);
            if (drafts.length) {
                const { data: added } = await supabase.from('radar_events').upsert(drafts.map((d) => ({ ...d, user_id: uid, case_id: c.case_id, contact_id: c.id })), { onConflict: 'contact_id,kind,ref', ignoreDuplicates: true }).select('title, detail, event_date');
                for (const e of (added ?? []) as { title: string; detail: string; event_date: string | null }[]) {
                    await supabase.from('case_entries').insert({ case_id: c.case_id, user_id: uid, kind: 'event', title: `Radar: ${e.title}`.slice(0, 200), body: e.detail, happened_on: e.event_date ?? now.slice(0, 10) });
                    found += 1;
                }
            }
            await supabase.from('radar_snapshots').upsert({ contact_id: c.id, user_id: uid, ico: c.ico, name: cur.name, address: cur.address, ended: cur.ended, checked_at: now, last_error: '' });
        }
        if (found) window.dispatchEvent(new CustomEvent('radar-sync', { detail: found }));
        return found;
    })().catch(() => 0).finally(() => { running = null; });
    return running;
}

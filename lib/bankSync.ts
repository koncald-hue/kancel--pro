import { supabase } from './supabase';
import { getMaster } from './e2ee';
import { syncFio, type Account, type ImportSummary } from './payments';

// Tiché automatické stahování z Fio (jen když je šifrovací heslo odemčené): nejvýše jednou za 10 minut a jedna synchronizace najednou
let running: Promise<ImportSummary | null> | null = null;
export function autoSyncBanks(userId: string, vatNow: boolean, force = false): Promise<ImportSummary | null> {
    running ??= (async () => {
        const master = getMaster();
        if (!master) return null;
        const { data } = await supabase.from('bank_accounts').select('*').eq('provider', 'fio');
        const total: ImportSummary = { added: 0, duplicates: 0, auto: 0, suggest: 0, overpay: 0, none: 0 };
        let did = false;
        for (const a of (data ?? []) as Account[]) {
            if (!force && a.last_sync_at && Date.now() - new Date(a.last_sync_at).getTime() < 10 * 60_000) continue;
            try { const s = await syncFio(master, userId, a, vatNow); did = true; for (const k of Object.keys(total) as (keyof ImportSummary)[]) total[k] += s[k]; }
            catch { /* chyba se ukáže u účtu v Platbách; tiché stahování nesmí rušit práci */ }
        }
        if (did) window.dispatchEvent(new CustomEvent('bank-sync', { detail: total }));
        return did ? total : null;
    })().finally(() => { running = null; });
    return running;
}

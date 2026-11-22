// Odstranění ukázkových dat (spis, klient, hodiny, vyúčtování) jedním krokem.
import { supabase } from './supabase';
import { DEMO_CASE_LIKE, DEMO_MARK_LIKE } from './demoMarks';

export const DEMO_REMOVED_KEY = 'kancelar-demo-removed';

// Vrátí true, když se něco smazalo. Chyby se polykají: ukázka nesmí bránit skutečné práci.
export async function deleteDemoData(userId: string): Promise<boolean> {
    let removed = false;
    const run = async (p: PromiseLike<{ error: unknown; count?: number | null }>) => { try { const r = await p; if (!r.error && (r.count ?? 0) > 0) removed = true; } catch { /* ignorováno */ } };
    await run(supabase.from('invoices').delete({ count: 'exact' }).eq('user_id', userId).like('title', DEMO_CASE_LIKE));
    await run(supabase.from('time_entries').delete({ count: 'exact' }).eq('user_id', userId).like('description', DEMO_MARK_LIKE));
    await run(supabase.from('cases').delete({ count: 'exact' }).eq('user_id', userId).like('title', DEMO_CASE_LIKE));
    await run(supabase.from('lawyer_clients').delete({ count: 'exact' }).eq('user_id', userId).like('name', DEMO_MARK_LIKE));
    return removed;
}

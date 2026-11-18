import { supabase } from './supabase';

// Záznam úkonu správce (tabulka ops_log z migrace 20261118_20; bez ní se zápis tiše přeskočí)
export async function opsLog(action: string, target = '', detail = ''): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ops_log').insert({ staff_id: user.id, action: action.slice(0, 120), target: target.slice(0, 300), detail: detail.slice(0, 1000) });
}

import { supabase } from './supabase';
import type { AresCompany } from './ares';

// Firma z ARES se uloží mezi klienty (nebo se doplní stávajícímu klientovi stejného jména) a vrátí se její název
export async function upsertAresClient(userId: string, c: AresCompany): Promise<string> {
    const { data: existing, error } = await supabase.from('lawyer_clients').select('id, name, ico, dic, address').eq('user_id', userId);
    if (error) throw new Error(error.message);
    const hit = (existing ?? []).find((x: { name: string; ico?: string }) => x.name.toLowerCase() === c.name.toLowerCase() || (x.ico && x.ico === c.ico)) as { id: string; name: string; ico?: string; dic?: string; address?: string } | undefined;
    if (hit) {
        const patch: Record<string, string> = {};
        if (!hit.ico) patch.ico = c.ico;
        if (!hit.dic && c.dic) patch.dic = c.dic;
        if (!hit.address && c.address) patch.address = c.address;
        if (Object.keys(patch).length) { const { error: e2 } = await supabase.from('lawyer_clients').update(patch).eq('id', hit.id); if (e2) throw new Error(e2.message); }
        return hit.name;
    }
    const { error: e3 } = await supabase.from('lawyer_clients').insert({ user_id: userId, name: c.name, ico: c.ico, dic: c.dic, address: c.address, note: 'Z ARES' });
    if (e3) throw new Error(e3.message);
    return c.name;
}

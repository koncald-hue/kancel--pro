import { supabase } from './supabase';
import { todayIso, type DraftLine } from './billing';

// Založí koncept vyúčtování s hotovými řádky (např. z kalkulačky) a vrátí jeho id
export async function createDraftInvoice(p: { userId: string; title: string; caseId?: string | null; clientId?: string | null; lines: DraftLine[] }): Promise<string> {
    const { data, error } = await supabase.from('invoices').insert({ user_id: p.userId, issue_date: todayIso(), title: p.title.slice(0, 160), case_id: p.caseId ?? null, client_id: p.clientId ?? null }).select('id').single();
    if (error) throw new Error(error.message);
    const id = (data as { id: string }).id;
    if (p.lines.length) {
        const { error: lineError } = await supabase.from('invoice_lines').insert(p.lines.map((l, position) => ({ invoice_id: id, user_id: p.userId, position, description: l.description.slice(0, 500), qty: l.qty, unit: l.unit, unit_price: l.unit_price, vat_rate: l.vat_rate, price_item_id: null, time_entry_id: null })));
        if (lineError) { await supabase.from('invoices').delete().eq('id', id); throw new Error(lineError.message); }
    }
    return id;
}

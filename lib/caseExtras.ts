import { supabase } from './supabase';
import type { CaseExtras } from './templates';

// Údaje vybrané věci pro doplnění do vzoru: kontakty (protistrana), lhůty a výkazy
export async function loadCaseExtras(caseId: string): Promise<CaseExtras> {
    const [c, d, t] = await Promise.all([
        supabase.from('case_contacts').select('role, name, email, phone, ico').eq('case_id', caseId),
        supabase.from('case_deadlines').select('title, due_date, done').eq('case_id', caseId),
        supabase.from('time_entries').select('minutes, rate, billed').eq('case_id', caseId),
    ]);
    return { contacts: c.data ?? [], deadlines: d.data ?? [], entries: (t.data ?? []).map((e) => ({ ...e, minutes: Number(e.minutes), rate: Number(e.rate) })) };
}

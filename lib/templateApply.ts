import { supabase } from './supabase';
import { cleanItems, planTemplate, type CaseTemplate } from './taskTemplates';
import { scheduleGoogleSync } from './googleSync';

export async function loadTemplates(): Promise<CaseTemplate[]> {
    const { data, error } = await supabase.from('case_templates').select('id, name, items').order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, items: cleanItems(r.items) }));
}

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Založí z šablony úkoly ve věci. Úkoly vázané na datum události se přeskočí, když ho věc nemá (vrátí se jejich názvy).
export async function applyTemplate(tpl: CaseTemplate, caseId: string, userId: string, eventIso: string | null): Promise<{ created: number; skipped: string[] }> {
    const { ready, skipped } = planTemplate(tpl.items, todayIso(), eventIso);
    if (ready.length) {
        const { error } = await supabase.from('case_deadlines').insert(ready.map((r) => ({ case_id: caseId, user_id: userId, title: r.title.slice(0, 120), due_date: r.due, kind: 'ukol' })));
        if (error) throw new Error(error.message);
        scheduleGoogleSync();
    }
    return { created: ready.length, skipped };
}

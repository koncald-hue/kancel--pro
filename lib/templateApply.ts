import { supabase } from './supabase';
import { cleanItems, planTemplate, type CaseTemplate } from './taskTemplates';
import { scheduleGoogleSync } from './googleSync';

export async function loadTemplates(): Promise<CaseTemplate[]> {
    // Sloupec is_default vzniká až migrací 20261118_12; bez ní se výchozí šablona prostě nepoužije
    const { data, error } = await supabase.from('case_templates').select('*').order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, items: cleanItems(r.items), isDefault: r.is_default === true }));
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

export const defaultTemplate = (list: CaseTemplate[]) => list.find((t) => t.isDefault) ?? null;

// Vzorové šablony jedním klepnutím; první se rovnou nastaví jako výchozí
export async function addStarterTemplates(userId: string): Promise<CaseTemplate[]> {
    const { STARTER_TEMPLATES } = await import('./taskTemplates');
    const rows = STARTER_TEMPLATES.map((t, i) => ({ user_id: userId, name: t.name, items: t.items, is_default: i === 0 }));
    let res = await supabase.from('case_templates').insert(rows);
    if (res.error) res = await supabase.from('case_templates').insert(rows.map((r) => ({ user_id: r.user_id, name: r.name, items: r.items }))); // bez migrace 12
    if (res.error) throw new Error(res.error.message);
    return loadTemplates();
}

// Po založení věci: výchozí šablona (nebo vybraná) se použije sama; chyba založení věci nezablokuje
export async function applyDefaultTo(caseId: string, userId: string, eventIso: string | null = null): Promise<number> {
    try { const d = defaultTemplate(await loadTemplates()); return d ? (await applyTemplate(d, caseId, userId, eventIso)).created : 0; } catch { return 0; }
}

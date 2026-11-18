import { supabase } from './supabase';
import type { CalEvent, TeamTask } from './agenda';
import { scheduleGoogleSync } from './googleSync';

export type Colleague = { user_id: string; name: string };
const MISSING = /team_tasks|calendar_events|people_names|schema cache|does not exist/i;

// Kolegové z kanceláře (pro zadání úkolu a pozvání na událost); mimo kancelář prázdný seznam
export async function loadColleagues(): Promise<Colleague[]> {
    const { data, error } = await supabase.rpc('firm_colleagues');
    if (error || !data) return [];
    return (data as { user_id: string; name?: string; email?: string }[]).map((c) => ({ user_id: c.user_id, name: c.name || c.email || 'kolega' }));
}
export async function loadNames(ids: string[]): Promise<Record<string, string>> {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return {};
    const { data } = await supabase.rpc('people_names', { p_ids: uniq });
    return Object.fromEntries(((data ?? []) as { user_id: string; name: string }[]).map((r) => [r.user_id, r.name]));
}
export async function loadTasks(): Promise<TeamTask[] | null> {
    const { data, error } = await supabase.from('team_tasks').select('*').order('due_date').limit(2000);
    if (error) { if (MISSING.test(error.message)) return null; throw new Error(error.message); }
    return (data ?? []) as TeamTask[];
}
export async function loadEvents(from: string, to: string): Promise<CalEvent[] | null> {
    const { data, error } = await supabase.from('calendar_events').select('*').lt('starts_at', to).gte('ends_at', from).order('starts_at').limit(2000);
    if (error) { if (MISSING.test(error.message)) return null; throw new Error(error.message); }
    return (data ?? []) as CalEvent[];
}
export async function createTask(t: { created_by: string; assignee_id: string; title: string; note?: string; due_date: string; due_time?: string | null; priority?: 'normal' | 'high'; case_id?: string | null }) {
    const { error } = await supabase.from('team_tasks').insert({ ...t, title: t.title.trim().slice(0, 200), note: (t.note ?? '').trim().slice(0, 2000), due_time: t.due_time || null, case_id: t.case_id || null });
    if (error) throw new Error(MISSING.test(error.message) ? 'Úkoly pro kolegy se zapnou po spuštění migrace 20261118_21.' : error.message);
    scheduleGoogleSync();
}
// Počet nových (neviděných) úkolů pro mě od kolegů
export async function unseenCount(me: string): Promise<number> {
    const { count, error } = await supabase.from('team_tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', me).eq('status', 'open').is('seen_at', null);
    return error ? 0 : count ?? 0;
}

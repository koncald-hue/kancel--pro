import { supabase } from './supabase';
import { parseDuration, type TimeEntry } from './lawyer';
import { fmtMinutes, type Suggestion } from './workLog';

// Zápis potvrzených návrhů výkazu: vloží výkaz a návrh označí jako zpracovaný. Společné pro stránku Výkazy i večerní souhrn na nástěnce.
export type Edited = { minutes?: string; description?: string; caseId?: string; off?: boolean };
export async function confirmSuggestions(userId: string, list: Suggestion[], edits: Record<string, Edited>, rateFor: (caseId: string) => number): Promise<{ rows: TimeEntry[]; total: number }> {
    const rows: TimeEntry[] = []; let total = 0;
    for (const s of list) {
        const e = edits[s.key] ?? {}; if (e.off) continue;
        const minutes = parseDuration(e.minutes ?? fmtMinutes(s.minutes)); if (!minutes) continue;
        const caseId = e.caseId ?? s.caseId ?? '';
        const { data: row, error } = await supabase.from('time_entries').insert({ user_id: userId, case_id: caseId || null, entry_date: s.day, minutes, description: (e.description ?? s.description).trim().slice(0, 500), rate: rateFor(caseId) || 0 }).select('*').single();
        if (error) throw new Error(error.message);
        await supabase.from('work_activity').update({ time_entry_id: (row as TimeEntry).id }).in('id', s.activityIds);
        rows.push(row as TimeEntry); total += minutes;
    }
    return { rows, total };
}

// Souhrn dne pro nástěnku: dnešní návrhy (a nedokončené z minulých dnů zvlášť), součet minut a počet věcí
export function daySummary(list: Suggestion[], today: string): { today: Suggestion[]; older: Suggestion[]; minutes: number; cases: number } {
    const t = list.filter((s) => s.day === today); const o = list.filter((s) => s.day < today);
    return { today: t, older: o, minutes: t.reduce((s, x) => s + x.minutes, 0), cases: new Set(t.map((s) => s.caseId ?? '')).size };
}

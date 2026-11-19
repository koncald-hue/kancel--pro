import { supabase } from './supabase';
import { LEGAL_DEADLINES, type LegalDeadline } from '@/app/data/deadlines';
import { shiftToWorkingDay } from './workdays';

export type CaseStep = { text: string; done: boolean };
export type CaseUrgency = 'high' | 'medium' | 'low';

export type LegalCase = {
    id: string;
    // Vlastník věci; u věci sdílené kolegou je to jiný uživatel než já
    user_id?: string;
    title: string;
    situation: string;
    summary: string;
    urgency: CaseUrgency;
    steps: CaseStep[];
    deadline_ids: string[];
    offense_ids: string[];
    template_keys: string[];
    event_date: string | null;
    note: string;
    status: 'open' | 'done';
    pinned: boolean;
    // Údaje o věci (pro advokáty i úřady); sloupce vznikají až spuštěním case-meta.sql
    client_name?: string;
    reference?: string;
    authority?: string;
    client_id?: string | null;
    client_email?: string;
    client_phone?: string;
    // Archiv (migrace 20261118_19); mění je jen funkce archive_case
    archived_on?: string | null;
    archive_until?: string | null;
    archive_place?: string;
    disposed_on?: string | null;
    disposal?: string | null;
    // Rozpočet věci a nadřazená věc (migrace 20261119_27)
    budget_czk?: number | null;
    budget_warn_pct?: number;
    parent_id?: string | null;
    // Druh případu, štítky a odpovědná osoba (migrace 20261119_28)
    case_type?: string;
    labels?: string[];
    responsible?: string;
    created_at: string;
};

export type NewCase = Pick<LegalCase, 'title' | 'situation' | 'summary' | 'urgency' | 'steps' | 'deadline_ids' | 'offense_ids' | 'template_keys'>;

// Všechny sloupce: nové volitelné sloupce (údaje o věci, obrana) se načtou, jen když v databázi existují
const COLUMNS = '*';

export async function loadCases(): Promise<LegalCase[]> {
    const { data, error } = await supabase.from('cases').select(COLUMNS).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as LegalCase[];
}

export async function loadCase(id: string): Promise<LegalCase | null> {
    const { data, error } = await supabase.from('cases').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as LegalCase | null) ?? null;
}

export const BLANK_CASE = { situation: '', summary: '', urgency: 'medium' as CaseUrgency, steps: [], deadline_ids: [], offense_ids: [], template_keys: [] };

export async function createCase(userId: string, input: NewCase): Promise<LegalCase> {
    const { data, error } = await supabase.from('cases').insert({ ...input, user_id: userId }).select(COLUMNS).single();
    if (error) throw new Error(error.message);
    return data as LegalCase;
}

export async function updateCase(id: string, patch: Partial<Pick<LegalCase, 'steps' | 'event_date' | 'note' | 'status' | 'title' | 'summary' | 'situation' | 'pinned' | 'client_name' | 'client_email' | 'client_phone' | 'reference' | 'authority' | 'budget_czk' | 'budget_warn_pct' | 'parent_id' | 'case_type' | 'labels' | 'responsible'>>) {
    const { error } = await supabase.from('cases').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function deleteCase(id: string) {
    const { error } = await supabase.from('cases').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

// Konec lhůty od zadaného data události (stejný výpočet jako v kalkulačce lhůt)
export function computeDeadlineEnd(deadline: LegalDeadline, eventIso: string): Date | null {
    const target = new Date(`${eventIso}T12:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    if (deadline.type === 'days') target.setDate(target.getDate() + (deadline.durationDays || 0));
    else if (deadline.type === 'months') target.setMonth(target.getMonth() + (deadline.durationMonths || 0));
    else if (deadline.type === 'years') target.setFullYear(target.getFullYear() + (deadline.durationYears || 0));
    else if (deadline.type === 'months_next_first') {
        target.setDate(1);
        target.setMonth(target.getMonth() + 1 + (deadline.durationMonths || 0));
        target.setDate(0);
    } else return null;
    return shiftToWorkingDay(target).finalDate;
}

export function daysUntil(date: Date, now = new Date()): number {
    const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((a - b) / 86_400_000);
}

export const deadlineById = (id: string) => LEGAL_DEADLINES.find((d) => d.id === id);

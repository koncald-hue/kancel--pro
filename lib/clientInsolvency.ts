import { supabase } from './supabase';

export type ClientIns = { client_id: string; ic: string; watched: boolean; last_checked_at: string | null; last_error: string; active_count: number; ended_count: number; spis: string | null; state: string | null; url: string | null };
export type InsView = { tone: 'none' | 'ok' | 'wait' | 'bad' | 'ended' | 'error'; text: string; detail?: string };

// Co se o klientovi ukáže v seznamu: v insolvenci, bez nálezu, čeká na první kontrolu, bez IČO…
export function insView(c: ClientIns | undefined, hasIco: boolean): InsView {
    if (!hasIco) return { tone: 'none', text: 'bez IČO se nehlídá', detail: 'Doplňte IČO (u fyzické osoby hlídejte ručně v Insolvenci).' };
    if (!c || !c.watched) return { tone: 'wait', text: 'čeká na zařazení' };
    if (c.active_count > 0) return { tone: 'bad', text: 'V INSOLVENCI', detail: [c.state, c.spis].filter(Boolean).join(' · ') };
    if (c.last_error && !c.last_checked_at) return { tone: 'error', text: 'kontrola selhala', detail: c.last_error };
    if (!c.last_checked_at) return { tone: 'wait', text: 'čeká na první kontrolu' };
    if (c.ended_count > 0) return { tone: 'ended', text: 'dřívější řízení ukončeno', detail: `zkontrolováno ${new Date(c.last_checked_at).toLocaleDateString('cs-CZ')}` };
    return { tone: 'ok', text: 'bez nálezu', detail: `zkontrolováno ${new Date(c.last_checked_at).toLocaleDateString('cs-CZ')}` };
}

export const INS_TONE: Record<InsView['tone'], string> = { none: 'bg-slate-100 text-slate-500', ok: 'bg-emerald-100 text-emerald-900', wait: 'bg-sky-100 text-sky-900', bad: 'bg-rose-600 text-white', ended: 'bg-amber-100 text-amber-900', error: 'bg-rose-100 text-rose-900' };

export async function loadClientInsolvency(): Promise<ClientIns[] | null> {
    const { data, error } = await supabase.rpc('client_insolvency_status');
    return error ? null : ((data ?? []) as ClientIns[]);
}

export async function isirActive(): Promise<boolean> {
    const { data, error } = await supabase.rpc('isir_status');
    return !error && (data as { active?: boolean } | null)?.active === true;
}

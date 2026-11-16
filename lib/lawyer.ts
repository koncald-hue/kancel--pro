import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type LawyerAccess = { user_id: string; email: string; status: 'trial' | 'active' | 'requested' | 'expired'; until: string | null; firm_name: string; default_rate: number; intake_code?: string | null; display_name?: string; phone?: string; office?: string; website?: string; bar_number?: string; contact_email?: string; profession?: 'advokat' | 'jiny'; verification_status?: 'none' | 'pending' | 'verified' | 'rejected'; register_name?: string; verified_at?: string | null; verification_note?: string; e2ee_salt?: string | null; e2ee_wrapped_master?: string | null; firm_id?: string | null; ico?: string; dic?: string; vat_payer?: boolean; bank_account?: string; due_days?: number; invoice_note?: string; avatar_small?: string; avatar_large?: string };
export type LawyerClient = { id: string; name: string; email: string; phone: string; note: string; hourly_rate: number | null; address?: string; ico?: string; dic?: string };
export type TimeEntry = { id: string; case_id: string | null; entry_date: string; minutes: number; description: string; rate: number; billed: boolean };

export const TRIAL_DAYS = 14;

// Placený přístup: advokát s vyplněným profilem a zaplaceným (aktivním) předplatným; zkušební přístup se nepočítá
export const hasLawyerPass = (row: LawyerAccess | null | undefined): boolean => !!row && row.verification_status === 'verified' && row.status === 'active' && (!row.until || row.until >= todayIso());

// Profil je vyplněný (v databázi hodnota 'verified', viz supabase/profil.sql)
export const hasProfile = (row: LawyerAccess | null | undefined) => row?.verification_status === 'verified';
export const PROFESSION_LABELS = { advokat: 'Advokát (ČAK)', jiny: 'Jiný právník' } as const;
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Přístup do kanceláře: aktivní nebo zkušební a nevypršelý
export function hasLawyerAccess(row: LawyerAccess | null): boolean {
    if (!row) return false;
    if (row.status !== 'active' && row.status !== 'trial') return false;
    return !row.until || row.until >= todayIso();
}

export async function loadLawyerAccess(userId: string): Promise<LawyerAccess | null> {
    const { data, error } = await supabase.from('lawyer_access').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as LawyerAccess | null) ?? null;
}

export async function startTrial(userId: string, email: string): Promise<LawyerAccess> {
    const { data, error } = await supabase.from('lawyer_access').insert({ user_id: userId, email, status: 'trial', until: addDays(TRIAL_DAYS) }).select('*').single();
    if (error) throw new Error(error.message);
    return data as LawyerAccess;
}

export async function requestAccess(userId: string, email: string): Promise<LawyerAccess> {
    const { data, error } = await supabase.from('lawyer_access').insert({ user_id: userId, email, status: 'requested' }).select('*').single();
    if (error) throw new Error(error.message);
    return data as LawyerAccess;
}

export type LawyerState = { loading: boolean; access: LawyerAccess | null; error: string };

export function useLawyerAccess(userId: string | undefined, version = 0): LawyerState {
    const [state, setState] = useState<{ key: string; access: LawyerAccess | null; error: string }>({ key: '', access: null, error: '' });
    const key = userId ? `${userId}:${version}` : '';
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        loadLawyerAccess(userId)
            .then((access) => { if (!cancelled) setState({ key, access, error: '' }); })
            .catch((err) => { if (!cancelled) setState({ key, access: null, error: /lawyer_access|relation|does not exist/i.test(String(err)) ? 'setup' : 'failed' }); });
        return () => { cancelled = true; };
    }, [userId, key]);
    const ready = !!userId && state.key === key;
    return { loading: !!userId && !ready, access: ready ? state.access : null, error: ready ? state.error : '' };
}

// „1:30“, „1h30“, „1,5h“, „90“, „45m“ → minuty (0 = nerozpoznáno)
export function parseDuration(input: string): number {
    const text = input.trim().toLowerCase().replace(',', '.');
    let m = text.match(/^(\d+):(\d{1,2})$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    m = text.match(/^(\d+)\s*h\s*(\d{1,2})?\s*(?:m|min)?$/);
    if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
    m = text.match(/^(\d+(?:\.\d+)?)\s*h(?:od)?$/);
    if (m) return Math.round(Number(m[1]) * 60);
    m = text.match(/^(\d+)\s*(?:m|min)?$/);
    if (m) return Number(m[1]);
    return 0;
}

export const formatMinutes = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
export const entryAmount = (e: Pick<TimeEntry, 'minutes' | 'rate'>) => (e.minutes / 60) * e.rate;
export const czk = (n: number) => `${new Intl.NumberFormat('cs-CZ').format(Math.round(n))} Kč`;

// CSV pro Excel (středník, UTF-8 s BOM)
export function timesheetCsv(rows: { entry: TimeEntry; caseTitle: string; client: string }[]): string {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['Datum', 'Věc', 'Klient', 'Popis', 'Hodiny', 'Sazba', 'Částka', 'Vyfakturováno'].map(q).join(';')];
    for (const { entry, caseTitle, client } of rows) {
        lines.push([entry.entry_date, caseTitle, client, entry.description, (entry.minutes / 60).toFixed(2).replace('.', ','), String(entry.rate), entryAmount(entry).toFixed(2).replace('.', ','), entry.billed ? 'ano' : 'ne'].map((v) => q(String(v))).join(';'));
    }
    return `﻿${lines.join('\r\n')}\r\n`;
}

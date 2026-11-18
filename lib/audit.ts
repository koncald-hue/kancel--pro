import { supabase } from './supabase';

export type AuditRow = { at: string; actor_name: string; case_id: string | null; case_title: string | null; action: AuditAction; entity: string; summary: string; changed: string[] };
export type AuditAction = 'vytvoreno' | 'zmeneno' | 'smazano' | 'otevreno' | 'stazeno' | 'exportovano';

export const ACTION_LABEL: Record<AuditAction, string> = { vytvoreno: 'Vytvořeno', zmeneno: 'Změněno', smazano: 'Smazáno', otevreno: 'Otevřeno', stazeno: 'Staženo', exportovano: 'Exportováno' };
export const ENTITY_LABEL: Record<string, string> = {
    cases: 'Věc', case_files: 'Soubor', case_entries: 'Chronologie', case_deadlines: 'Lhůta / úkol', case_contacts: 'Kontakt', case_folders: 'Složka', case_members: 'Sdílení věci',
    client_links: 'Klientský odkaz', client_requests: 'Požadavek na klienta', client_messages: 'Zpráva klienta', signature_requests: 'Podpis', client_identifications: 'Identifikace klienta',
    case_properties: 'Nemovitost', case_research: 'Rešerše', case_data_messages: 'Datová zpráva', time_entries: 'Výkaz času', invoices: 'Faktura', lawyer_clients: 'Klient',
};
export const COLUMN_LABEL: Record<string, string> = { title: 'název', name: 'jméno', due_date: 'datum', done: 'splněno', status: 'stav', client_visible: 'viditelné klientovi', note: 'poznámka', body: 'text', role: 'role', revoked: 'zrušeno', expires_at: 'platnost', assignee_id: 'odpovědná osoba', kind: 'druh', confirmed_at: 'potvrzení data', client_name: 'klient', reference: 'spisová značka', authority: 'úřad' };

export async function loadAudit(opts: { caseId?: string; from?: string; to?: string; limit?: number } = {}): Promise<AuditRow[]> {
    const { data, error } = await supabase.rpc('audit_list', { p_case: opts.caseId || null, p_from: opts.from || null, p_to: opts.to || null, p_limit: opts.limit ?? 1000 });
    if (error) throw new Error(/audit_list|schema cache|does not exist/i.test(error.message) ? 'Auditní záznam zatím není v databázi zapnutý (chybí migrace 20261118_06).' : error.message);
    return (data ?? []) as AuditRow[];
}

// Zápis otevření věci, stažení souboru a exportu. Selhání nesmí zdržet práci.
export function logCaseEvent(caseId: string, action: 'otevreno' | 'stazeno' | 'exportovano', entity = 'cases', summary = ''): void {
    if (!/^[0-9a-f-]{36}$/i.test(caseId)) return;
    void Promise.resolve(supabase.rpc('log_case_event', { p_case: caseId, p_action: action, p_entity: entity, p_summary: summary.slice(0, 300) })).catch(() => undefined);
}

// CSV pro Excel: oddělovač středník, UTF-8 s BOM, buňky začínající = + - @ se předsadí apostrofem (ochrana proti spuštění vzorce)
const cell = (v: string) => { const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function auditCsv(rows: AuditRow[]): string {
    const head = ['Čas', 'Kdo', 'Věc', 'Událost', 'Druh záznamu', 'Název', 'Změněno'];
    const lines = rows.map((r) => [new Date(r.at).toLocaleString('cs-CZ'), r.actor_name, r.case_title ?? '', ACTION_LABEL[r.action] ?? r.action, ENTITY_LABEL[r.entity] ?? r.entity, r.summary, r.changed.map((c) => COLUMN_LABEL[c] ?? c).join(', ')].map((x) => cell(String(x))).join(';'));
    return '﻿' + [head.join(';'), ...lines].join('\r\n') + '\r\n';
}

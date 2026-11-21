// Podací deník: přijatá a odeslaná pošta s číslem jednacím kanceláře (číslo přiděluje databáze).
import { supabase } from './supabase';

export type Channel = 'datovka' | 'email' | 'listinna' | 'osobne' | 'jine';
export type MailLogRow = { id: string; user_id: string; case_id: string | null; year: number; seq: number; direction: 'in' | 'out'; channel: Channel; event_on: string; counterparty: string; their_ref: string; subject: string; attachments: number; delivered_on: string | null; delivery_note: string; source_ref: string | null; note: string; created_at: string };
export const CHANNEL_LABEL: Record<Channel, string> = { datovka: 'Datová schránka', email: 'E-mail', listinna: 'Listinná pošta', osobne: 'Osobně', jine: 'Jinak' };
export const DIRECTION_LABEL = { in: 'Přijato', out: 'Odesláno' } as const;

export const refNo = (r: Pick<MailLogRow, 'year' | 'seq'>) => `${r.year}/${String(r.seq).padStart(4, '0')}`;
const dmy = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}` : '');

export function deliveryState(r: Pick<MailLogRow, 'direction' | 'channel' | 'delivered_on'>): 'n/a' | 'doruceno' | 'ceka' {
    // Doručení se sleduje u datové schránky (dodejka) a listinné pošty (doručenka); e-mail ani osobní předání ho nemají
    if (r.direction === 'in' || r.channel === 'osobne' || r.channel === 'email' || r.channel === 'jine') return 'n/a';
    return r.delivered_on ? 'doruceno' : 'ceka';
}

export function logCsv(rows: MailLogRow[], caseTitle: (id: string | null) => string): string {
    const q = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const head = 'Č. j.;Datum;Směr;Způsob;Odesílatel / adresát;Jejich č. j.;Spis (předmět);Příloh;Spis;Doručeno;Poznámka k doručení;Poznámka';
    return '﻿' + [head, ...rows.map((r) => [refNo(r), dmy(r.event_on), DIRECTION_LABEL[r.direction], CHANNEL_LABEL[r.channel], q(r.counterparty), q(r.their_ref), q(r.subject), r.attachments, q(caseTitle(r.case_id)), dmy(r.delivered_on), q(r.delivery_note), q(r.note)].join(';'))].join('\r\n') + '\r\n';
}

// Zápis do deníku z jiné části aplikace (e-mail, datová schránka). Stejná zpráva (source_ref) se zapíše jen jednou.
// Bez migrace 20261118_19 tabulka neexistuje: tiše se nic nestane, hlavní úkon (uložení do věci) to nesmí zastavit.
export async function logMail(row: { user_id: string; case_id: string | null; direction: 'in' | 'out'; channel: Channel; event_on: string; counterparty: string; subject: string; their_ref?: string; attachments?: number; source_ref?: string | null; delivered_on?: string | null }): Promise<'ok' | 'dup' | 'skip'> {
    const { error } = await supabase.from('mail_log').insert({ ...row, subject: (row.subject || '(bez předmětu)').slice(0, 300), counterparty: row.counterparty.slice(0, 300), their_ref: (row.their_ref ?? '').slice(0, 120), source_ref: row.source_ref ? row.source_ref.slice(0, 300) : null });
    if (!error) return 'ok';
    if (error.code === '23505') return 'dup';
    return 'skip';
}

// Číslo jednací cizího dokumentu z textu nebo předmětu: „č. j. KSPL 45 INS 123/2026“, „Č.j.: MMP/1234/2026“, „sp. zn. 12 C 5/2026“
export function findTheirRef(text: string): string {
    const m = text.match(/(?:č\.\s*j\.|čj\.|č\.j\.|spis\.?\s*zn\.|sp\.\s*zn\.)\s*:?\s*([A-ZÁ-Ža-zá-ž0-9][\w\s./-]{0,40}?\/(?:19|20)\d{2})(?!\d)/i);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

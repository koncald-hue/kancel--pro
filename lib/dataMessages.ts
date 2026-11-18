import { findTheirRef, logMail } from './mailLog';
import { supabase } from './supabase';
import { insertRow, updateRow, uploadCaseFile } from './caseFile';
import type { LegalCase } from './cases';

export type DmInfo = { id: string; sender: string; recipient: string; annotation: string; delivered: string; accepted: string; status: string };
export type SavedMessage = { id: string; case_id: string; dm_id: string; direction: 'received' | 'sent'; sender: string; recipient: string; annotation: string; delivered_at: string | null; status: string; files_saved: number; created_at: string };

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, '');

// Navrhne věc podle spisové značky nebo názvu věci ve „věci“ zprávy (např. „Žaloba, sp. zn. 12 C 34/2026“)
export function suggestCase(cases: Pick<LegalCase, 'id' | 'title' | 'reference' | 'status'>[], annotation: string): string {
    const text = norm(annotation);
    if (!text) return '';
    const byRef = cases.filter((c) => c.reference && norm(c.reference).length >= 4 && text.includes(norm(c.reference)));
    if (byRef.length) return (byRef.find((c) => c.status === 'open') ?? byRef[0]).id;
    const byTitle = cases.filter((c) => norm(c.title).length >= 6 && text.includes(norm(c.title)));
    return byTitle[0]?.id ?? '';
}

export const dmMarker = (dmId: string) => `Datová zpráva ${dmId}`;

// Uloží záznam o zprávě ke věci (jen jednou), zapíše ji do chronologie a přidá přílohy, které tam ještě nejsou
export async function saveMessageToCase(userId: string, caseId: string, direction: 'received' | 'sent', m: DmInfo, files: File[] = []): Promise<{ recordNew: boolean; saved: number; skipped: number }> {
    const { data: existing, error } = await supabase.from('case_data_messages').select('id, files_saved').eq('case_id', caseId).eq('dm_id', m.id).maybeSingle();
    if (error) throw new Error(error.message);
    const when = m.delivered || m.accepted || new Date().toISOString();
    let rowId = existing?.id as string | undefined;
    let filesSaved = Number(existing?.files_saved ?? 0);
    const recordNew = !existing;
    if (!existing) {
        const row = await insertRow<{ id: string }>('case_data_messages', { case_id: caseId, user_id: userId, dm_id: m.id, direction, sender: m.sender, recipient: m.recipient, annotation: m.annotation, delivered_at: when, status: m.status });
        rowId = row.id;
        try { await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: `${direction === 'received' ? 'Přijatá' : 'Odeslaná'} datová zpráva: ${m.annotation || 'bez věci'}`.slice(0, 200), body: `${direction === 'received' ? `Odesílatel: ${m.sender}` : `Adresát: ${m.recipient}`}. ID zprávy ${m.id}.`, happened_on: when.slice(0, 10) }); } catch { /* chronologie není kritická */ }
    }
    // Podací deník: zpráva uložená do věci se zapíše jednou (podle ID datové zprávy); u odeslané se doručení doplní později
    if (recordNew) {
        await logMail({ user_id: userId, case_id: caseId, direction: direction === 'received' ? 'in' : 'out', channel: 'datovka', event_on: when.slice(0, 10), counterparty: (direction === 'received' ? m.sender : m.recipient) || '', subject: m.annotation || 'Datová zpráva', their_ref: findTheirRef(m.annotation || ''), attachments: files.length, source_ref: m.id ? `isds:${m.id}` : null, delivered_on: direction === 'sent' && m.accepted ? m.accepted.slice(0, 10) : null }).catch(() => 'skip');
    }
    let saved = 0; let skipped = 0;
    if (files.length) {
        const { data: have } = await supabase.from('case_files').select('name').eq('case_id', caseId).eq('note', dmMarker(m.id));
        const names = new Set((have ?? []).map((f: { name: string }) => f.name));
        for (const f of files) {
            if (names.has(f.name)) { skipped += 1; continue; }
            const row = await uploadCaseFile(userId, caseId, null, f);
            await updateRow('case_files', row.id, { note: dmMarker(m.id) });
            saved += 1;
        }
        if (rowId && saved) { filesSaved += saved; await supabase.from('case_data_messages').update({ files_saved: filesSaved }).eq('id', rowId); }
    }
    return { recordNew, saved, skipped };
}

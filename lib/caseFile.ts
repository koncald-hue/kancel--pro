import { supabase } from './supabase';
import { computeDeadlineEnd, deadlineById, type LegalCase } from './cases';

export type CaseFolder = { id: string; case_id: string; name: string };
export type CaseFile = { id: string; case_id: string; folder_id: string | null; name: string; path: string; size: number; mime: string; note: string; created_at: string; source?: string; client_visible?: boolean; request_id?: string | null; enc?: boolean };
export type CaseEntry = { id: string; case_id: string; kind: 'event' | 'note'; title: string; body: string; happened_on: string | null; pinned: boolean; created_at: string; client_visible?: boolean };
export type CaseDeadline = { id: string; case_id: string; title: string; due_date: string; done: boolean; client_visible?: boolean };
export type CaseContact = { id: string; case_id: string; role: string; name: string; email: string; phone: string; note: string };

export type CaseBundle = { folders: CaseFolder[]; files: CaseFile[]; entries: CaseEntry[]; deadlines: CaseDeadline[]; contacts: CaseContact[] };

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_CASE_BYTES = 100 * 1024 * 1024;
export const DEFAULT_FOLDERS = ['Doručené dokumenty', 'Moje podání', 'Důkazy a fotky', 'Komunikace'];

type Table = 'case_data_messages' | 'case_folders' | 'case_files' | 'case_entries' | 'case_deadlines' | 'case_contacts' | 'client_links' | 'client_requests' | 'client_messages';

export async function loadBundle(caseId: string): Promise<CaseBundle> {
    const get = async <T>(table: Table, order: string, ascending: boolean): Promise<T[]> => {
        const { data, error } = await supabase.from(table).select('*').eq('case_id', caseId).order(order, { ascending });
        if (error) throw new Error(error.message);
        return (data ?? []) as T[];
    };
    const [folders, files, entries, deadlines, contacts] = await Promise.all([
        get<CaseFolder>('case_folders', 'created_at', true),
        get<CaseFile>('case_files', 'created_at', false),
        get<CaseEntry>('case_entries', 'created_at', false),
        get<CaseDeadline>('case_deadlines', 'due_date', true),
        get<CaseContact>('case_contacts', 'created_at', true),
    ]);
    return { folders, files, entries, deadlines, contacts };
}

export async function insertRow<T>(table: Table, row: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.from(table).insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return data as T;
}

export async function updateRow(table: Table, id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function deleteRow(table: Table, id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export const safeFileName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'soubor';

export async function uploadCaseFile(userId: string, caseId: string, folderId: string | null, file: File): Promise<CaseFile> {
    if (file.size > MAX_FILE_BYTES) throw new Error(`Soubor „${file.name}“ je větší než 15 MB.`);
    const path = `${userId}/${caseId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from('case-files').upload(path, file, { contentType: file.type || undefined });
    if (error) throw new Error(error.message);
    try {
        return await insertRow<CaseFile>('case_files', { case_id: caseId, folder_id: folderId, user_id: userId, name: file.name, path, size: file.size, mime: file.type });
    } catch (err) {
        await supabase.storage.from('case-files').remove([path]);
        throw err;
    }
}

export async function removeCaseFile(file: Pick<CaseFile, 'id' | 'path'>) {
    await deleteRow('case_files', file.id);
    await supabase.storage.from('case-files').remove([file.path]);
}

export async function openCaseFile(path: string, download = false) {
    const { data, error } = await supabase.storage.from('case-files').createSignedUrl(path, 120, download ? { download: true } : undefined);
    if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo otevřít.');
    window.open(data.signedUrl, '_blank', 'noopener');
}

// Smaže soubory případu z úložiště (řádky v databázi zmizí samy s případem)
export async function removeCaseStorage(files: Pick<CaseFile, 'path'>[]) {
    if (files.length) await supabase.storage.from('case-files').remove(files.map((f) => f.path));
}

export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export type CaseDeadlineView = { key: string; title: string; date: Date; iso: string; done: boolean; source: 'law' | 'custom'; customId?: string };

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Všechny lhůty případu: zákonné (spočítané z data události) i vlastní, seřazené podle konce
export function collectDeadlines(item: Pick<LegalCase, 'event_date' | 'deadline_ids'>, customs: CaseDeadline[]): CaseDeadlineView[] {
    const law = item.event_date
        ? item.deadline_ids.flatMap((id): CaseDeadlineView[] => {
            const deadline = deadlineById(id);
            const end = deadline ? computeDeadlineEnd(deadline, item.event_date!) : null;
            return deadline && end ? [{ key: `law-${id}`, title: deadline.title, date: end, iso: toIso(end), done: false, source: 'law' }] : [];
        })
        : [];
    const custom = customs.map((c): CaseDeadlineView => ({ key: `c-${c.id}`, title: c.title, date: new Date(`${c.due_date}T12:00:00`), iso: c.due_date, done: c.done, source: 'custom', customId: c.id }));
    return [...law, ...custom].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Kalendář (.ics): celodenní události s upozorněním 3 dny a 1 den předem
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (line: string) => (line.length <= 73 ? line : line.match(/.{1,73}/g)!.join('\r\n '));

export function buildIcs(caseTitle: string, items: { uid: string; title: string; iso: string }[], stamp = new Date()): string {
    const dt = (iso: string) => iso.replace(/-/g, '');
    const stampText = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pravo srozumitelne//Spis//CS', 'CALSCALE:GREGORIAN'];
    for (const item of items) {
        const end = new Date(`${item.iso}T12:00:00`);
        end.setDate(end.getDate() + 1);
        lines.push(
            'BEGIN:VEVENT',
            `UID:${item.uid}@pravo-srozumitelne`,
            `DTSTAMP:${stampText}`,
            `DTSTART;VALUE=DATE:${dt(item.iso)}`,
            `DTEND;VALUE=DATE:${dt(toIso(end))}`,
            `SUMMARY:${icsEscape(`Lhůta: ${item.title}`)}`,
            `DESCRIPTION:${icsEscape(`Případ: ${caseTitle}`)}`,
            'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Blíží se lhůta', 'TRIGGER:-P3D', 'END:VALARM',
            'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Lhůta končí zítra', 'TRIGGER:-P1D', 'END:VALARM',
            'END:VEVENT',
        );
    }
    lines.push('END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
}

export function downloadTextFile(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

// Srozumitelná chyba; když chybí tabulky nebo úložiště, připomene spuštění SQL
export function describeCaseError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    if (/does not exist|schema cache|relation|bucket not found|case_|cases/i.test(text)) return 'Spis ještě není v databázi zapnutý (chybí spuštění SQL cases.sql a case-files.sql).';
    if (/exceeded|too large|size/i.test(text)) return 'Soubor je příliš velký (nejvýše 15 MB).';
    return text || 'Něco se nepovedlo. Zkuste to prosím znovu.';
}

// Vlastní lhůty ze všech případů přihlášeného uživatele (pro přehled nadcházejících termínů)
export async function loadAllDeadlines(): Promise<CaseDeadline[]> {
    const { data, error } = await supabase.from('case_deadlines').select('*').order('due_date', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CaseDeadline[];
}

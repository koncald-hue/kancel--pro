// Obsah zpráv v chatu kanceláře a jeho převod z věcí / klientů / nemovitostí a zpět.
// Všechno se skládá a čte v prohlížeči; do databáze jde jen zašifrovaná podoba (viz e2eeShare.ts).
import { supabase } from './supabase';
import { createCase, loadCase, updateCase, type CaseStep, type CaseUrgency } from './cases';
import { insertRow, loadBundle, uploadCaseFile, MAX_FILE_BYTES, type CaseBundle, type CaseFile } from './caseFile';
import type { PropertySnapshot } from './katastr';

export type ChatKind = 'text' | 'file' | 'case' | 'client' | 'property';

export type SharedCase = {
    title: string; situation: string; summary: string; urgency: CaseUrgency; steps: CaseStep[]; deadline_ids: string[]; offense_ids: string[]; template_keys: string[];
    event_date: string | null; note: string; client_name: string; client_email: string; client_phone: string; reference: string; authority: string;
};
export type SharedFile = { name: string; size: number; mime: string; i: number; folder: string };
export type SharedClient = { name: string; email: string; phone: string; address: string; ico: string; dic: string; note: string };

export type ChatPayload =
    | { v: 1; kind: 'text'; text: string }
    | { v: 1; kind: 'file'; note: string; files: SharedFile[] }
    | { v: 1; kind: 'case'; note: string; case: SharedCase; entries: { kind: 'event' | 'note'; title: string; body: string; happened_on: string | null }[]; deadlines: { title: string; due_date: string; done: boolean }[]; contacts: { role: string; name: string; email: string; phone: string; note: string }[]; properties: { label: string; snapshot: PropertySnapshot; data_as_of: string }[]; files: SharedFile[]; skippedFiles: number }
    | { v: 1; kind: 'client'; note: string; client: SharedClient }
    | { v: 1; kind: 'property'; note: string; label: string; snapshot: PropertySnapshot; data_as_of: string };

export const MAX_CASE_SHARE_FILES = 30;
export const MAX_CASE_SHARE_BYTES = 60 * 1024 * 1024;
export const MAX_TEXT = 4000;

export const KIND_LABELS: Record<ChatKind, string> = { text: 'Zpráva', file: 'Soubor', case: 'Spis', client: 'Klient', property: 'Nemovitost' };

// Co se z věci pošle: údaje, chronologie, lhůty, kontakty, uložené nemovitosti a nahrané soubory (soubory šifrované klientským kanálem se přeskočí)
export async function prepareCaseShare(caseId: string, note = ''): Promise<{ payload: Extract<ChatPayload, { kind: 'case' }>; files: CaseFile[]; totalBytes: number }> {
    const item = await loadCase(caseId);
    if (!item) throw new Error('Spis nebyla nalezena.');
    const bundle: CaseBundle = await loadBundle(caseId);
    const props = await supabase.from('case_properties').select('label, snapshot, data_as_of').eq('case_id', caseId);
    const usable = bundle.files.filter((f) => !(f as CaseFile & { enc?: boolean }).enc && f.size <= MAX_FILE_BYTES);
    const skipped = bundle.files.length - usable.length;
    const chosen: CaseFile[] = [];
    let total = 0;
    for (const f of usable) { if (chosen.length >= MAX_CASE_SHARE_FILES || total + f.size > MAX_CASE_SHARE_BYTES) break; chosen.push(f); total += f.size; }
    const folderName = new Map(bundle.folders.map((f) => [f.id, f.name]));
    return {
        files: chosen, totalBytes: total,
        payload: {
            v: 1, kind: 'case', note,
            case: { title: item.title, situation: item.situation, summary: item.summary, urgency: item.urgency, steps: item.steps, deadline_ids: item.deadline_ids, offense_ids: item.offense_ids, template_keys: item.template_keys, event_date: item.event_date, note: item.note, client_name: item.client_name ?? '', client_email: item.client_email ?? '', client_phone: item.client_phone ?? '', reference: item.reference ?? '', authority: item.authority ?? '' },
            entries: bundle.entries.map((e) => ({ kind: e.kind, title: e.title, body: e.body, happened_on: e.happened_on })),
            deadlines: bundle.deadlines.map((d) => ({ title: d.title, due_date: d.due_date, done: d.done })),
            contacts: bundle.contacts.map((c) => ({ role: c.role, name: c.name, email: c.email, phone: c.phone, note: c.note })),
            properties: ((props.data ?? []) as { label: string; snapshot: PropertySnapshot; data_as_of: string }[]),
            files: chosen.map((f, i) => ({ name: f.name, size: f.size, mime: f.mime, i, folder: f.folder_id ? folderName.get(f.folder_id) ?? '' : '' })),
            skippedFiles: skipped + (usable.length - chosen.length),
        },
    };
}

export async function fetchCaseFileBytes(file: Pick<CaseFile, 'path'>): Promise<Uint8Array> {
    const { data, error } = await supabase.storage.from('case-files').download(file.path);
    if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo načíst.');
    return new Uint8Array(await data.arrayBuffer());
}

// Převzetí věci od kolegy: vznikne nová věc u příjemce (včetně souborů, které se dešifrují a uloží znovu)
export async function importCase(userId: string, payload: Extract<ChatPayload, { kind: 'case' }>, fromName: string, getFile: (i: number) => Promise<Uint8Array>, onProgress?: (done: number, total: number) => void): Promise<string> {
    const c = payload.case;
    const created = await createCase(userId, { title: c.title.slice(0, 100) || 'Převzatý spis', situation: c.situation, summary: c.summary, urgency: c.urgency, steps: c.steps, deadline_ids: c.deadline_ids, offense_ids: c.offense_ids, template_keys: c.template_keys });
    await updateCase(created.id, { event_date: c.event_date, note: c.note, client_name: c.client_name, client_email: c.client_email, client_phone: c.client_phone, reference: c.reference, authority: c.authority });
    const row = { case_id: created.id, user_id: userId };
    await insertRow('case_entries', { ...row, kind: 'note', title: 'Převzato od kolegy', body: `Spis převzata od ${fromName} dne ${new Date().toLocaleDateString('cs-CZ')}.${payload.note ? `\n\n${payload.note}` : ''}`, happened_on: null });
    for (const e of payload.entries) await insertRow('case_entries', { ...row, kind: e.kind, title: e.title.slice(0, 200), body: e.body, happened_on: e.happened_on });
    for (const d of payload.deadlines) await insertRow('case_deadlines', { ...row, title: d.title.slice(0, 200), due_date: d.due_date, done: d.done });
    for (const k of payload.contacts) await insertRow('case_contacts', { ...row, role: k.role, name: k.name, email: k.email, phone: k.phone, note: k.note });
    for (const p of payload.properties) await supabase.from('case_properties').insert({ ...row, label: p.label.slice(0, 200), snapshot: p.snapshot, data_as_of: p.data_as_of });
    const folders = new Map<string, string>();
    for (const name of new Set(payload.files.map((f) => f.folder).filter(Boolean))) folders.set(name, (await insertRow<{ id: string }>('case_folders', { ...row, name: name.slice(0, 60) })).id);
    let done = 0;
    onProgress?.(0, payload.files.length);
    for (const f of payload.files) {
        const bytes = await getFile(f.i);
        const file = new File([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], f.name, { type: f.mime || undefined });
        await uploadCaseFile(userId, created.id, f.folder ? folders.get(f.folder) ?? null : null, file);
        onProgress?.(++done, payload.files.length);
    }
    return created.id;
}

// Převzetí klienta: nový klient, nebo doplnění prázdných údajů stávajícího se stejným jménem
export async function importClient(userId: string, c: SharedClient): Promise<'created' | 'updated'> {
    const { data } = await supabase.from('lawyer_clients').select('*').eq('user_id', userId).ilike('name', c.name.replace(/[%_]/g, '\\$&')).maybeSingle();
    if (!data) {
        const { error } = await supabase.from('lawyer_clients').insert({ user_id: userId, name: c.name, email: c.email, phone: c.phone, address: c.address, ico: c.ico, dic: c.dic, note: c.note });
        if (error) throw new Error(error.message);
        return 'created';
    }
    const patch: Record<string, string> = {};
    for (const k of ['email', 'phone', 'address', 'ico', 'dic'] as const) if (!(data as Record<string, string>)[k] && c[k]) patch[k] = c[k];
    if (Object.keys(patch).length) { const { error } = await supabase.from('lawyer_clients').update(patch).eq('id', (data as { id: string }).id); if (error) throw new Error(error.message); }
    return 'updated';
}

export async function addPropertyToCase(userId: string, caseId: string, p: { label: string; snapshot: PropertySnapshot; data_as_of: string }) {
    const { error } = await supabase.from('case_properties').insert({ case_id: caseId, user_id: userId, label: p.label.slice(0, 200), snapshot: p.snapshot, data_as_of: p.data_as_of });
    if (error) throw new Error(error.message);
}

export function previewText(p: ChatPayload): string {
    switch (p.kind) {
        case 'text': return p.text.slice(0, 80);
        case 'file': return `Soubor: ${p.files.map((f) => f.name).join(', ').slice(0, 70)}`;
        case 'case': return `Spis: ${p.case.title}`;
        case 'client': return `Klient: ${p.client.name}`;
        case 'property': return `Nemovitost: ${p.label}`;
    }
}

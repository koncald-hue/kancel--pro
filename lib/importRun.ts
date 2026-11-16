import { supabase } from './supabase';
import { fold, type Entity, type ExistingCase, type ExistingClient, type Planned } from './importer';

const CHUNK = 200;
export type Progress = (done: number, total: number, label: string) => void;
export type RunResult = { batchId: string; created: number; updated: number; clientsCreated: number };

async function insertChunks(table: string, rows: Record<string, unknown>[], onStep: (n: number) => void): Promise<{ id: string }[]> {
    const ids: { id: string }[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
        const { data, error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK)).select('id');
        if (error) throw new Error(/import_batch|import_batches|schema cache/i.test(error.message) ? 'Import zatím není v databázi zapnutý (chybí spuštění souboru import.sql).' : error.message);
        ids.push(...((data ?? []) as { id: string }[])); onStep(Math.min(CHUNK, rows.length - i));
    }
    return ids;
}

export async function loadExisting(): Promise<{ clients: ExistingClient[]; cases: ExistingCase[] }> {
    const [c, k] = await Promise.all([
        supabase.from('lawyer_clients').select('id, name, email, phone, address, ico, dic, birth, note, hourly_rate').limit(20000),
        supabase.from('cases').select('id, title, reference, client_id').limit(20000),
    ]);
    if (c.error) throw new Error(c.error.message);
    if (k.error) throw new Error(k.error.message);
    return { clients: (c.data ?? []) as ExistingClient[], cases: (k.data ?? []) as ExistingCase[] };
}

export async function runImport(userId: string, entity: Entity, plan: Planned[], opt: { source: string; defaultRate: number; clients: ExistingClient[] }, progress: Progress): Promise<RunResult> {
    const work = plan.filter((p) => p.action === 'create' || p.action === 'update');
    const { data: batch, error: be } = await supabase.from('import_batches').insert({ user_id: userId, entity, source: opt.source.slice(0, 200) }).select('id').single();
    if (be) throw new Error(/import_batches|schema cache|does not exist/i.test(be.message) ? 'Import zatím není v databázi zapnutý (chybí spuštění souboru import.sql).' : be.message);
    const batchId = (batch as { id: string }).id;
    let done = 0; const total = work.length; const step = (n: number, label: string) => { done += n; progress(done, total, label); };
    let created = 0; let updated = 0; let clientsCreated = 0;
    const base = { user_id: userId, import_batch: batchId };

    try {
        if (entity === 'klienti') {
            const rows = work.filter((p) => p.action === 'create').map((p) => { const r = p.row.rec; return { ...base, name: r.name.slice(0, 200), email: r.email ?? '', phone: r.phone ?? '', address: r.address ?? '', ico: r.ico ?? '', dic: r.dic ?? '', birth: r.birth || null, note: r.note ?? '', hourly_rate: r.rate ? Number(r.rate) : null }; });
            created = (await insertChunks('lawyer_clients', rows, (n) => step(n, 'Klienti'))).length;
            for (const p of work.filter((x) => x.action === 'update' && x.clientId && x.patch)) {
                const { error } = await supabase.from('lawyer_clients').update(p.patch as Record<string, unknown>).eq('id', p.clientId as string);
                if (error) throw new Error(error.message); updated += 1; step(1, 'Klienti');
            }
        } else if (entity === 'veci') {
            // Nově zakládaní klienti (u věcí, jejichž klient v adresáři chybí); jeden klient se založí jen jednou
            const virtual = new Map<string, Record<string, string>>();
            for (const p of work) if (p.newClient && p.clientId) virtual.set(p.clientId, p.newClient);
            const real = new Map<string, string>();
            if (virtual.size) {
                const keys = [...virtual.keys()];
                const ids = await insertChunks('lawyer_clients', keys.map((k) => ({ ...base, name: virtual.get(k)!.name.slice(0, 200), email: virtual.get(k)!.email ?? '', phone: virtual.get(k)!.phone ?? '' })), () => undefined);
                keys.forEach((k, i) => real.set(k, ids[i].id)); clientsCreated = ids.length;
            }
            const byId = new Map(opt.clients.map((c) => [c.id, c]));
            const rows = work.map((p) => {
                const r = p.row.rec; const cid = p.clientId ? (p.clientId.startsWith('new:') ? real.get(p.clientId) ?? null : p.clientId) : null;
                const c = cid ? byId.get(cid) : undefined; const v = p.clientId ? virtual.get(p.clientId) : undefined;
                return { ...base, title: r.title.slice(0, 200), situation: r.description ?? '', summary: '', urgency: 'medium', steps: [], deadline_ids: [], offense_ids: [], template_keys: [], note: r.note ?? '', status: r.status === 'done' ? 'done' : 'open', reference: r.reference ?? '', authority: r.authority ?? '', client_id: cid, client_name: r.client ?? '', client_email: r.clientEmail || c?.email || v?.email || '', client_phone: r.clientPhone || c?.phone || v?.phone || '' };
            });
            created = (await insertChunks('cases', rows, (n) => step(n, 'Věci'))).length;
        } else if (entity === 'lhuty') {
            created = (await insertChunks('case_deadlines', work.map((p) => ({ ...base, case_id: p.caseId, title: p.row.rec.title.slice(0, 200), due_date: p.row.rec.date, done: p.row.rec.done === '1' })), (n) => step(n, 'Lhůty'))).length;
        } else if (entity === 'kontakty') {
            created = (await insertChunks('case_contacts', work.map((p) => { const r = p.row.rec; return { ...base, case_id: p.caseId, name: r.name.slice(0, 200), role: (r.role ?? '').slice(0, 80), email: r.email ?? '', phone: r.phone ?? '', note: r.note ?? '' }; }), (n) => step(n, 'Kontakty'))).length;
        } else {
            created = (await insertChunks('time_entries', work.map((p) => { const r = p.row.rec; return { ...base, case_id: p.caseId ?? null, entry_date: r.date, minutes: Number(r.minutesOut), description: (r.description ?? '').slice(0, 500), rate: r.rate ? Number(r.rate) : opt.defaultRate, billed: r.billed === '1' }; }), (n) => step(n, 'Čas'))).length;
        }
    } catch (e) {
        // Rozdělaný import se hned vrátí, aby nezůstala půlka dat
        await undoImport(batchId).catch(() => undefined);
        throw e;
    }
    await supabase.from('import_batches').update({ counts: { created, updated, clientsCreated } }).eq('id', batchId);
    return { batchId, created, updated, clientsCreated };
}

// Vrácení importu: smaže vše, co dávka vytvořila (věci i s jejich lhůtami, soubory a kontakty). Doplněné údaje u stávajících klientů se nevracejí.
export async function undoImport(batchId: string) {
    for (const t of ['time_entries', 'case_deadlines', 'case_contacts', 'cases', 'lawyer_clients']) {
        const { error } = await supabase.from(t).delete().eq('import_batch', batchId);
        if (error) throw new Error(error.message);
    }
    await supabase.from('import_batches').update({ undone: true }).eq('id', batchId);
}

export const sameFold = (a: string, b: string) => fold(a) === fold(b);

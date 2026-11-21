import { supabase } from './supabase';
import { ENTITY_ORDER, fold, type Entity, type ExistingCase, type ExistingClient, type Planned } from './importer';

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

type Base = { user_id: string; import_batch: string };
const caseRow = (base: Base, c: { title: string; reference?: string; authority?: string; description?: string; note?: string; status?: string; clientId?: string | null; clientName?: string; clientEmail?: string; clientPhone?: string }) => ({
    ...base, title: c.title.slice(0, 200), situation: c.description ?? '', summary: '', urgency: 'medium', steps: [], deadline_ids: [], offense_ids: [], template_keys: [], note: c.note ?? '',
    status: c.status === 'done' ? 'done' : 'open', reference: c.reference ?? '', authority: c.authority ?? '', client_id: c.clientId ?? null, client_name: c.clientName ?? '', client_email: c.clientEmail ?? '', client_phone: c.clientPhone ?? '',
});

export type ImportStep = { entity: Entity; plan: Planned[] };
export type WorkbookResult = RunResult & { casesCreated: number; byEntity: Partial<Record<Entity, number>> };

// Import jednoho nebo víc listů v jedné dávce (jde vrátit najednou). Dočasná id „new:…“ z plánu se během zápisu nahrazují skutečnými,
// takže lhůty, kontakty a čas se připojí i k věcem a klientům, které vznikly o list dřív.
export async function runWorkbook(userId: string, steps: ImportStep[], opt: { source: string; defaultRate: number; clients: ExistingClient[] }, progress: Progress): Promise<WorkbookResult> {
    const ordered = [...steps].sort((a, b) => ENTITY_ORDER.indexOf(a.entity) - ENTITY_ORDER.indexOf(b.entity));
    const work = ordered.map((s) => ({ entity: s.entity, items: s.plan.filter((p) => p.action === 'create' || p.action === 'update') })).filter((s) => s.items.length);
    if (!work.length) throw new Error('Není co importovat.');
    const { data: batch, error: be } = await supabase.from('import_batches').insert({ user_id: userId, entity: work[0].entity, source: opt.source.slice(0, 200) }).select('id').single();
    if (be) throw new Error(/import_batches|schema cache|does not exist/i.test(be.message) ? 'Import zatím není v databázi zapnutý (chybí spuštění souboru import.sql).' : be.message);
    const batchId = (batch as { id: string }).id;
    const total = work.reduce((n, s) => n + s.items.length, 0);
    let done = 0; const step = (n: number, label: string) => { done += n; progress(Math.min(done, total), total, label); };
    let created = 0; let updated = 0; let clientsCreated = 0; let casesCreated = 0; const byEntity: Partial<Record<Entity, number>> = {};
    const base: Base = { user_id: userId, import_batch: batchId };
    const real = new Map<string, string>();
    const resolve = (id: string | null | undefined) => (id ? (id.startsWith('new:') ? real.get(id) ?? null : id) : null);
    const byId = new Map(opt.clients.map((c) => [c.id, c]));

    // Věci, které chybí a odkazuje na ně lhůta, kontakt nebo čas, se založí jednou před vložením řádků
    async function createMissingCases(items: Planned[]) {
        const pending = new Map<string, NonNullable<Planned['newCase']>>();
        for (const p of items) if (p.newCase && p.caseId && !real.has(p.caseId)) pending.set(p.caseId, p.newCase);
        if (!pending.size) return;
        const keys = [...pending.keys()];
        const ids = await insertChunks('cases', keys.map((k) => caseRow(base, pending.get(k)!)), () => undefined);
        keys.forEach((k, i) => real.set(k, ids[i].id)); casesCreated += ids.length;
    }

    try {
        for (const { entity, items } of work) {
            let n = 0;
            if (entity === 'klienti') {
                const creates = items.filter((p) => p.action === 'create');
                const ids = await insertChunks('lawyer_clients', creates.map((p) => { const r = p.row.rec; return { ...base, name: r.name.slice(0, 200), email: r.email ?? '', phone: r.phone ?? '', address: r.address ?? '', ico: r.ico ?? '', dic: r.dic ?? '', birth: r.birth || null, note: r.note ?? '', hourly_rate: r.rate ? Number(r.rate) : null }; }), (k) => step(k, 'Klienti'));
                creates.forEach((p, i) => { if (p.selfId && ids[i]) real.set(p.selfId, ids[i].id); });
                n = ids.length;
                for (const p of items.filter((x) => x.action === 'update' && x.clientId && x.patch)) {
                    const { error } = await supabase.from('lawyer_clients').update(p.patch as Record<string, unknown>).eq('id', p.clientId as string);
                    if (error) throw new Error(error.message); updated += 1; step(1, 'Klienti');
                }
            } else if (entity === 'veci') {
                // Nově zakládaní klienti (u věcí, jejichž klient v adresáři chybí); jeden klient se založí jen jednou
                const virtual = new Map<string, Record<string, string>>();
                for (const p of items) if (p.newClient && p.clientId) virtual.set(p.clientId, p.newClient);
                if (virtual.size) {
                    const keys = [...virtual.keys()];
                    const ids = await insertChunks('lawyer_clients', keys.map((k) => ({ ...base, name: virtual.get(k)!.name.slice(0, 200), email: virtual.get(k)!.email ?? '', phone: virtual.get(k)!.phone ?? '' })), () => undefined);
                    keys.forEach((k, i) => real.set(k, ids[i].id)); clientsCreated += ids.length;
                }
                const ids = await insertChunks('cases', items.map((p) => {
                    const r = p.row.rec; const cid = resolve(p.clientId); const c = cid ? byId.get(cid) : undefined; const v = p.clientId ? virtual.get(p.clientId) : undefined;
                    return caseRow(base, { title: r.title, reference: r.reference, authority: r.authority, description: r.description, note: r.note, status: r.status, clientId: cid, clientName: r.client ?? '', clientEmail: r.clientEmail || c?.email || v?.email || '', clientPhone: r.clientPhone || c?.phone || v?.phone || '' });
                }), (k) => step(k, 'Věci'));
                items.forEach((p, i) => { if (p.selfId && ids[i]) real.set(p.selfId, ids[i].id); });
                n = ids.length;
            } else {
                await createMissingCases(items);
                const rows = items.filter((p) => entity === 'cas' || resolve(p.caseId));
                if (entity === 'lhuty') n = (await insertChunks('case_deadlines', rows.map((p) => ({ ...base, case_id: resolve(p.caseId), title: p.row.rec.title.slice(0, 200), due_date: p.row.rec.date, done: p.row.rec.done === '1' })), (k) => step(k, 'Lhůty'))).length;
                else if (entity === 'kontakty') n = (await insertChunks('case_contacts', rows.map((p) => { const r = p.row.rec; return { ...base, case_id: resolve(p.caseId), name: r.name.slice(0, 200), role: (r.role ?? '').slice(0, 80), email: r.email ?? '', phone: r.phone ?? '', note: r.note ?? '' }; }), (k) => step(k, 'Kontakty'))).length;
                else n = (await insertChunks('time_entries', rows.map((p) => { const r = p.row.rec; return { ...base, case_id: resolve(p.caseId), entry_date: r.date, minutes: Number(r.minutesOut), description: (r.description ?? '').slice(0, 500), rate: r.rate ? Number(r.rate) : opt.defaultRate, billed: r.billed === '1' }; }), (k) => step(k, 'Čas'))).length;
            }
            created += n; byEntity[entity] = (byEntity[entity] ?? 0) + n;
        }
    } catch (e) {
        // Rozdělaný import se hned vrátí, aby nezůstala půlka dat
        await undoImport(batchId).catch(() => undefined);
        throw e;
    }
    await supabase.from('import_batches').update({ counts: { created, updated, clientsCreated, casesCreated, byEntity } }).eq('id', batchId);
    return { batchId, created, updated, clientsCreated, casesCreated, byEntity };
}

export async function runImport(userId: string, entity: Entity, plan: Planned[], opt: { source: string; defaultRate: number; clients: ExistingClient[] }, progress: Progress): Promise<RunResult> {
    const r = await runWorkbook(userId, [{ entity, plan }], opt, progress);
    return { batchId: r.batchId, created: r.created, updated: r.updated, clientsCreated: r.clientsCreated };
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

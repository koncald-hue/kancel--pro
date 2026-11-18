import { supabase } from './supabase';
import { loadCases } from './cases';
import { partiesFromTitle, type PoolEntry } from './conflicts';

type ContactRow = { case_id: string; name: string; role: string; email: string };
const isOpposite = (role: string) => /protistr|odpůrc|žalovan|oponent/i.test(role);

// Klienti, protistrany a strany z názvů věcí, které advokát sám vidí (včetně věcí sdílených kolegy)
export async function loadConflictPool(): Promise<PoolEntry[]> {
    const [clients, cases, contacts] = await Promise.all([
        supabase.from('lawyer_clients').select('name, ico, email'),
        loadCases().catch(() => []),
        supabase.from('case_contacts').select('case_id, name, role, email'),
    ]);
    const byId = new Map(cases.map((c) => [c.id, c]));
    const pool: PoolEntry[] = [];
    for (const c of (clients.data ?? []) as { name: string; ico?: string; email?: string }[]) pool.push({ kind: 'klient', name: c.name, ico: c.ico, email: c.email });
    for (const c of cases) {
        const closed = c.status === 'done';
        if (c.client_name) pool.push({ kind: 'klient', name: c.client_name, email: c.client_email, caseId: c.id, caseTitle: c.title, closed });
        const sides = partiesFromTitle(c.title);
        // „Novák proti Dvořákovi“: první strana bývá náš klient, druhá protistrana; jen jako slabší nápověda
        if (sides[1]) pool.push({ kind: 'protistrana', name: sides[1], caseId: c.id, caseTitle: c.title, closed });
    }
    for (const k of (contacts.data ?? []) as ContactRow[]) {
        if (!isOpposite(k.role)) continue;
        const c = byId.get(k.case_id);
        pool.push({ kind: 'protistrana', name: k.name, email: k.email, caseId: k.case_id, caseTitle: c?.title, closed: c?.status === 'done' });
    }
    return pool;
}

export type FirmHit = { term: string; kind: 'klient' | 'protistrana'; n: number };

// Shody u kolegů ve stejné kanceláři: jen existence a role, nikdy jméno ani věc (migrace 20261118_13)
export async function firmConflicts(names: string[], icos: string[]): Promise<{ hits: FirmHit[]; available: boolean }> {
    const { data, error } = await supabase.rpc('conflict_firm_check', { p_names: names.filter(Boolean).slice(0, 10), p_icos: icos.filter(Boolean).slice(0, 10) });
    if (error) return { hits: [], available: !/conflict_firm_check|schema cache|does not exist/i.test(error.message) };
    return { hits: ((data ?? []) as { term: string; kind: 'klient' | 'protistrana'; n: number | string }[]).map((r) => ({ term: r.term, kind: r.kind, n: Number(r.n) })), available: true };
}

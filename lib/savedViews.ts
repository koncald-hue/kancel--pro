// Uložené přehledy věcí: pojmenovaná sada filtrů, kterou advokát jedním kliknutím znovu použije
export type CaseFilter = { status: 'open' | 'done'; q: string; client: string; within: 0 | 7 | 30; kind: 'all' | 'main' | 'sub'; type: string };
export const DEFAULT_FILTER: CaseFilter = { status: 'open', q: '', client: '', within: 0, kind: 'all', type: '' };

// Neznámé nebo poškozené hodnoty z databáze se vrátí na výchozí, ať přehled nikdy nespadne
export function parseFilter(raw: unknown): CaseFilter {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
        status: o.status === 'done' ? 'done' : 'open',
        q: typeof o.q === 'string' ? o.q.slice(0, 100) : '',
        client: typeof o.client === 'string' ? o.client.slice(0, 120) : '',
        within: o.within === 7 || o.within === 30 ? o.within : 0,
        kind: o.kind === 'main' || o.kind === 'sub' ? o.kind : 'all',
        type: typeof o.type === 'string' ? o.type.slice(0, 40) : '',
    };
}

export const isDefault = (f: CaseFilter) => JSON.stringify(f) === JSON.stringify(DEFAULT_FILTER);

export function matchesFilter(c: { status: string; title: string; summary: string; situation: string; client_name?: string; reference?: string; authority?: string; parent_id?: string | null; case_type?: string; labels?: string[] }, nextInDays: number | null, f: CaseFilter): boolean {
    const text = `${c.title} ${c.summary} ${c.situation} ${c.client_name ?? ''} ${c.reference ?? ''} ${c.authority ?? ''} ${(c.labels ?? []).join(' ')}`.toLowerCase();
    if (c.status !== f.status) return false;
    if (f.q && !text.includes(f.q.toLowerCase())) return false;
    if (f.client && (c.client_name ?? '') !== f.client) return false;
    if (f.type && (c.case_type ?? '') !== f.type) return false;
    if (f.within && (nextInDays === null || nextInDays > f.within)) return false;
    if (f.kind === 'sub' && !c.parent_id) return false;
    if (f.kind === 'main' && c.parent_id) return false;
    return true;
}

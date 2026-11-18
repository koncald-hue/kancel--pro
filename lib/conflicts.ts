// Kontrola střetu zájmů: porovná osobu nebo firmu (jméno, IČO, e-mail) s klienty, protistranami a věcmi kanceláře.
// Počítá se jen v prohlížeči nad daty, která advokát vidí; žádná jména se nikam neposílají (ani do AI).

export type Party = { name: string; ico?: string; email?: string };
export type PoolKind = 'klient' | 'protistrana' | 'vec';
export type PoolEntry = { kind: PoolKind; name: string; ico?: string; email?: string; caseId?: string; caseTitle?: string; closed?: boolean };
export type Hit = { entry: PoolEntry; score: number; why: 'ico' | 'email' | 'jmeno' | 'podobne'; severity: 'high' | 'medium' | 'low' };

const LEGAL_FORMS = new Set(['sro', 'as', 'spol', 'ks', 'vos', 'zs', 'zu', 'se', 'sp', 'op', 'po', 'ltd', 'gmbh', 'inc', 'llc', 'ag', 'sa', 'bv', 'oz', 'z']);
const TITLES = new Set(['judr', 'mudr', 'mvdr', 'phdr', 'rndr', 'ing', 'bc', 'mgr', 'phd', 'csc', 'mba', 'dis', 'prof', 'doc', 'arch', 'paeddr']);
const STOP = new Set(['a', 'i', 'pan', 'pani', 'paní', 'manzele', 'manzelé']);

export const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const digitsOnly = (s: string | undefined) => (s ?? '').replace(/\D/g, '');

export function nameTokens(name: string): string[] {
    return stripDiacritics(name).toLowerCase().replace(/\./g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t && !LEGAL_FORMS.has(t) && !TITLES.has(t) && !STOP.has(t));
}
export const normalizeName = (name: string) => nameTokens(name).sort().join(' ');

// Odliší tvary jmen: „Jan Novák“ a „Novák Jan“ jsou stejné; „Nováková“ a „Novák“ jen podobné
const stem = (t: string) => (t.length > 5 ? t.slice(0, -1) : t);

function nameScore(a: string, b: string): { score: number; why: 'jmeno' | 'podobne' } | null {
    const ta = nameTokens(a), tb = nameTokens(b);
    if (!ta.length || !tb.length) return null;
    if (ta.slice().sort().join(' ') === tb.slice().sort().join(' ')) return { score: 100, why: 'jmeno' };
    const sa = ta.map(stem), sb = tb.map(stem);
    const [small, big] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
    const common = small.filter((t) => big.includes(t)).length;
    // Jediné slovo (třeba jen příjmení) je málo na jistotu, proto nejvýš „podobné“
    if (small.length >= 2 && common === small.length) return { score: 80, why: 'podobne' };
    if (common >= 2 && common / big.length >= 0.6) return { score: 65, why: 'podobne' };
    if (small.length === 1 && big.length >= 2 && common === 1 && small[0].length >= 5) return { score: 45, why: 'podobne' };
    return null;
}

export function matchParty(party: Party, entry: PoolEntry): { score: number; why: Hit['why'] } | null {
    const ico = digitsOnly(party.ico), eico = digitsOnly(entry.ico);
    if (ico.length >= 6 && eico && ico === eico) return { score: 100, why: 'ico' };
    const em = (party.email ?? '').trim().toLowerCase(), ee = (entry.email ?? '').trim().toLowerCase();
    if (em && ee && em === ee) return { score: 95, why: 'email' };
    return nameScore(party.name, entry.name);
}

// Závažnost: kdo je dnes naše strana a kdo byl protistranou. role = jakou stranu zastupujeme u nové věci
export function severityOf(role: 'klient' | 'protistrana', entry: PoolEntry, score: number): Hit['severity'] {
    const crossed = (role === 'protistrana' && entry.kind === 'klient') || (role === 'klient' && entry.kind === 'protistrana');
    if (crossed) return entry.closed && score < 100 ? 'medium' : score >= 80 ? 'high' : 'medium';
    return score >= 80 ? 'medium' : 'low';
}

export function findConflicts(party: Party, role: 'klient' | 'protistrana', pool: PoolEntry[]): Hit[] {
    // Jeden člověk v pozici klienta ve více záznamech (karta klienta, věc) se ukáže jednou, nejlépe s věcí
    const byKey = new Map<string, Hit>();
    for (const entry of pool) {
        const m = matchParty(party, entry); if (!m) continue;
        const key = `${entry.kind}|${normalizeName(entry.name)}`;
        const prev = byKey.get(key);
        if (prev && (prev.entry.caseId || !entry.caseId)) continue;
        byKey.set(key, { entry, score: m.score, why: m.why, severity: severityOf(role, entry, m.score) });
    }
    const hits = [...byKey.values()];
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return hits.sort((a, b) => rank[a.severity] - rank[b.severity] || b.score - a.score);
}

// Z názvu věci „Novák proti Dvořákovi“ vytáhne strany. Skloňování řeší jen podobnost jmen, proto je výsledek vždy „podobné“.
export function partiesFromTitle(title: string): string[] {
    const parts = title.split(/\s+(?:proti|vs\.?|versus|contra)\s+/i).map((s) => s.replace(/[.,;:–-]+$/g, '').trim()).filter((s) => s.length >= 3);
    return parts.length > 1 ? parts : [];
}

export const KIND_LABEL: Record<PoolKind, string> = { klient: 'náš klient', protistrana: 'protistrana ve věci', vec: 'věc' };
export const SEVERITY_LABEL: Record<Hit['severity'], string> = { high: 'Možný střet zájmů', medium: 'Ke kontrole', low: 'Shoda stejné strany' };

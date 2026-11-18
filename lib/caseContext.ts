// Podklad pro AI z dat věci: hlavička, otevřené lhůty a úkoly, chronologie a vybrané dokumenty.
// Skládá se v prohlížeči, advokát ho před odesláním vidí celý; identifikátory pak zakryje redact().
import type { CaseDeadline, CaseEntry } from './caseFile';
import type { LegalCase } from './cases';

export type AiTask = 'summary' | 'reply' | 'brief' | 'client' | 'draft' | 'ask';
export type Doc = { name: string; body: string };

export const DRAFT_TYPES = [
    ['vyzva', 'Předžalobní výzva k plnění'],
    ['dopis', 'Dopis protistraně'],
    ['vyjadreni', 'Vyjádření k podání protistrany'],
    ['zaloba', 'Žaloba (kostra)'],
    ['odvolani', 'Odvolání (kostra)'],
    ['navrh', 'Návrh soudu nebo úřadu'],
    ['jine', 'Jiný dokument'],
] as const;
export type DraftType = (typeof DRAFT_TYPES)[number][0];

const dateCz = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)}. ${Number(m)}. ${y}`; };

export function caseHeader(c: Pick<LegalCase, 'title' | 'reference' | 'authority' | 'client_name' | 'status' | 'summary' | 'note'>): string {
    return [
        `Věc: ${c.title}`,
        c.client_name ? `Klient: ${c.client_name}` : '',
        c.reference ? `Spisová značka: ${c.reference}` : '',
        c.authority ? `Soud / úřad: ${c.authority}` : '',
        `Stav: ${c.status === 'done' ? 'uzavřená' : 'otevřená'}`,
        c.summary ? `Shrnutí: ${c.summary}` : '',
        c.note ? `Poznámka advokáta: ${c.note}` : '',
    ].filter(Boolean).join('\n');
}

export function deadlinesText(list: Pick<CaseDeadline, 'title' | 'due_date' | 'done' | 'kind'>[], today: string): string {
    const open = list.filter((d) => !d.done).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 20);
    if (!open.length) return '';
    return 'Otevřené lhůty a úkoly:\n' + open.map((d) => `- ${dateCz(d.due_date)}${d.due_date < today ? ' (PO TERMÍNU)' : ''}: ${d.kind === 'ukol' ? 'úkol' : 'lhůta'} – ${d.title}`).join('\n');
}

export function chronologyText(entries: Pick<CaseEntry, 'title' | 'body' | 'happened_on' | 'created_at'>[], max = 40): string {
    const rows = [...entries].sort((a, b) => (a.happened_on ?? a.created_at).localeCompare(b.happened_on ?? b.created_at)).slice(-max);
    if (!rows.length) return '';
    return 'Chronologie:\n' + rows.map((e) => `- ${dateCz(e.happened_on ?? e.created_at)}: ${e.title}${e.body ? ` – ${e.body.replace(/\s+/g, ' ').slice(0, 300)}` : ''}`).join('\n');
}

// Dokumenty se vejdou do zbývajícího místa rovným dílem; každý se ořízne a označí
export function docsText(docs: Doc[], budget: number): string {
    if (!docs.length || budget < 400) return '';
    const per = Math.floor((budget - 40 * docs.length) / docs.length);
    return docs.map((d) => { const b = d.body.replace(/\s+\n/g, '\n').trim(); return `=== Dokument: ${d.name} ===\n${b.length > per ? `${b.slice(0, per)}\n[… zkráceno]` : b}`; }).join('\n\n');
}

export function buildContext(opt: { task: AiTask; item: Parameters<typeof caseHeader>[0]; deadlines: Parameters<typeof deadlinesText>[0]; entries: Parameters<typeof chronologyText>[0]; docs: Doc[]; today: string; max: number; draftType?: DraftType; instructions?: string; question?: string; pasted?: string }): string {
    const lead: string[] = [];
    if (opt.task === 'draft') lead.push(`ÚKOL: ${DRAFT_TYPES.find(([id]) => id === opt.draftType)?.[1] ?? 'Dokument'}`, opt.instructions?.trim() ? `Pokyny advokáta: ${opt.instructions.trim()}` : '');
    if (opt.task === 'ask') lead.push(`OTÁZKA: ${(opt.question ?? '').trim()}`);
    const base = [lead.filter(Boolean).join('\n'), caseHeader(opt.item), deadlinesText(opt.deadlines, opt.today), chronologyText(opt.entries), opt.pasted?.trim() ? `Vložený text:\n${opt.pasted.trim()}` : ''].filter(Boolean).join('\n\n');
    const docs = docsText(opt.docs, opt.max - base.length - 4);
    return [base, docs].filter(Boolean).join('\n\n').slice(0, opt.max);
}

import { Briefcase, CalendarClock, Clock3, FileText, Inbox, Landmark, Library, NotebookText, Receipt, Users, UserRound, type LucideIcon } from 'lucide-react';

export type SearchRow = { kind: string; id: string; case_id: string | null; title: string; snippet: string | null; rank: number };

type Meta = { label: string; icon: LucideIcon; href: (r: SearchRow) => string };
const inCase = (r: SearchRow) => (r.case_id ? `/kancelar/veci/${r.case_id}` : '/kancelar/veci');

// Kam vede který druh nálezu a jak se jmenuje skupina
export const KINDS: Record<string, Meta> = {
    vec: { label: 'Věci', icon: Briefcase, href: (r) => `/kancelar/veci/${r.id}` },
    klient: { label: 'Klienti', icon: Users, href: () => '/kancelar/klienti' },
    zapis: { label: 'Zápisy a poznámky', icon: NotebookText, href: inCase },
    kontakt: { label: 'Kontakty ve věcech', icon: UserRound, href: inCase },
    soubor: { label: 'Soubory', icon: FileText, href: inCase },
    lhuta: { label: 'Lhůty', icon: CalendarClock, href: inCase },
    poptavka: { label: 'Poptávky', icon: Inbox, href: () => '/kancelar/poptavky' },
    vzor: { label: 'Vzory', icon: Library, href: () => '/kancelar/knihovna' },
    vykaz: { label: 'Výkazy práce', icon: Clock3, href: () => '/kancelar/vykazy' },
    faktura: { label: 'Faktury', icon: Receipt, href: (r) => `/kancelar/faktury/${r.id}` },
    nemovitost: { label: 'Nemovitosti', icon: Landmark, href: inCase },
};
export const KIND_ORDER = ['vec', 'klient', 'zapis', 'kontakt', 'soubor', 'lhuta', 'poptavka', 'vzor', 'vykaz', 'faktura', 'nemovitost'];

// Seskupení podle druhu, uvnitř skupiny lepší shody (v názvu) nahoře
export function groupResults(rows: SearchRow[]): { kind: string; rows: SearchRow[] }[] {
    return KIND_ORDER.map((kind) => ({ kind, rows: rows.filter((r) => r.kind === kind).sort((a, b) => a.rank - b.rank) })).filter((g) => g.rows.length > 0);
}

// Rozdělí text na části před nálezem, nález a za ním; hledá se bez ohledu na velikost písmen a diakritiku
export function splitMatch(text: string, query: string): [string, string, string] {
    const strip = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const src = text.normalize('NFC');
    const q = strip(query.trim());
    const at = q ? strip(src).indexOf(q) : -1;
    // Odstranění diakritiky nemění délku u složených znaků, jen proto lze použít stejné pozice
    if (at < 0 || strip(src).length !== src.length) return [text, '', ''];
    return [src.slice(0, at), src.slice(at, at + q.length), src.slice(at + q.length)];
}

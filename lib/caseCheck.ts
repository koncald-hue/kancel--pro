// Kontrola stavu věci (před jednáním nebo podáním): co ve spisu chybí nebo hoří. Jen pomůcka, nic se neblokuje.
// Kontrolu samotného podání datovou zprávou dělá lib/preflight.ts.
export type CaseCheck = { id: string; level: 'ok' | 'warn' | 'error'; text: string; tab?: string };

type In = {
    item: { client_name?: string; client_id?: string | null; reference?: string; authority?: string };
    files: { name: string }[];
    deadlines: { title: string; due_date: string; done: boolean }[];
    contacts: { role: string; name: string }[];
    today: string;
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const POA = /pln\w?[\s_.-]*moc|plnamoc|power[\s_-]*of[\s_-]*attorney/;
const list = (xs: { title: string }[]) => `${xs.slice(0, 3).map((d) => d.title).join(', ')}${xs.length > 3 ? ` a další (${xs.length - 3})` : ''}`;

export function caseCheck({ item, files, deadlines, contacts, today }: In): CaseCheck[] {
    const out: CaseCheck[] = [];
    out.push(item.client_name?.trim() || item.client_id ? { id: 'klient', level: 'ok', text: 'Klient je přiřazený.' } : { id: 'klient', level: 'error', text: 'Věc nemá klienta. Bez něj nejde fakturovat ani vést klientskou stránku.', tab: 'prehled' });
    out.push(files.some((f) => POA.test(fold(f.name))) ? { id: 'pm', level: 'ok', text: 'Plná moc je ve spisu.' } : { id: 'pm', level: 'warn', text: 'Ve spisu není soubor s plnou mocí (hledá se „plná moc“ v názvu souboru).', tab: 'soubory' });
    if (item.authority?.trim() || item.reference?.trim()) {
        if (!item.reference?.trim()) out.push({ id: 'sz', level: 'warn', text: 'Chybí spisová značka nebo číslo jednací.', tab: 'prehled' });
        else if (!item.authority?.trim()) out.push({ id: 'soud', level: 'warn', text: 'Chybí soud nebo úřad.', tab: 'prehled' });
        else out.push({ id: 'sz', level: 'ok', text: 'Spisová značka a soud jsou vyplněné.' });
    }
    const open = deadlines.filter((d) => !d.done);
    const late = open.filter((d) => d.due_date < today);
    const soon = open.filter((d) => d.due_date >= today && daysBetween(today, d.due_date) <= 3);
    if (late.length) out.push({ id: 'po', level: 'error', text: `Po termínu: ${list(late)}.`, tab: 'lhuty' });
    if (soon.length) out.push({ id: 'brzy', level: 'warn', text: `Do 3 dnů: ${list(soon)}.`, tab: 'lhuty' });
    if (!late.length && !soon.length) out.push({ id: 'lhuty', level: 'ok', text: open.length ? 'Žádná lhůta ani úkol nehoří.' : 'Nejsou zadané žádné lhůty ani úkoly.' });
    out.push(contacts.some((c) => /protistr|odpurc|zalovan/.test(fold(c.role))) ? { id: 'ps', level: 'ok', text: 'Protistrana je zapsaná v kontaktech.' } : { id: 'ps', level: 'warn', text: 'V kontaktech chybí protistrana. Bez ní nejde zkontrolovat střet zájmů.', tab: 'kontakty' });
    const rank = { error: 0, warn: 1, ok: 2 } as const;
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

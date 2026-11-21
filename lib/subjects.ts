// Subjekty napříč věcmi: stejná osoba nebo firma, která se objevuje v kontaktech více věcí nebo mezi klienty, se sloučí do jednoho záznamu.
// Spojuje se podle IČO, e-mailu, telefonu a jména (bez diakritiky a velikosti písmen). Nic se neukládá, počítá se z existujících kontaktů.
export type SourceContact = { id: string; case_id: string; role: string; name: string; email: string; phone: string; ico?: string };
export type SourceClient = { id: string; name: string; email: string; phone: string; ico?: string | null };
export type CaseRef = { id: string; title: string };
export type Appearance = { caseId: string; caseTitle: string; role: string; contactId: string };
export type Subject = { key: string; name: string; emails: string[]; phones: string[]; icos: string[]; clientIds: string[]; appearances: Appearance[]; contactIds: string[] };

const plain = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const phoneKey = (s: string) => { const d = s.replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
const keysOf = (x: { name: string; email: string; phone: string; ico?: string | null }): string[] => [
    x.ico && /^\d{8}$/.test(x.ico.replace(/\s/g, '')) ? `i:${x.ico.replace(/\s/g, '')}` : '',
    x.email.includes('@') ? `e:${x.email.trim().toLowerCase()}` : '',
    phoneKey(x.phone) ? `p:${phoneKey(x.phone)}` : '',
    plain(x.name).split(' ').length >= 2 ? `n:${plain(x.name)}` : '',
].filter(Boolean);

export function buildSubjects(contacts: SourceContact[], clients: SourceClient[], cases: CaseRef[]): Subject[] {
    type Item = { name: string; email: string; phone: string; ico: string; clientId?: string; ap?: Appearance; contactId?: string };
    const items: Item[] = [
        ...clients.map((c) => ({ name: c.name, email: c.email, phone: c.phone, ico: c.ico ?? '', clientId: c.id })),
        ...contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone, ico: c.ico ?? '', contactId: c.id, ap: { caseId: c.case_id, caseTitle: cases.find((x) => x.id === c.case_id)?.title ?? 'Spis', role: c.role, contactId: c.id } })),
    ].filter((i) => i.name.trim());
    // Sloučení přes sdílené klíče (union-find)
    const parent = items.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const seen = new Map<string, number>();
    items.forEach((it, i) => keysOf(it).forEach((k) => { const j = seen.get(k); if (j === undefined) seen.set(k, i); else parent[find(i)] = find(j); }));
    const groups = new Map<number, number[]>();
    items.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); });
    const uniq = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];
    return [...groups.values()].map((idx) => {
        const g = idx.map((i) => items[i]);
        const names = g.map((x) => x.name.trim()).sort((a, b) => b.length - a.length);
        return {
            key: String(idx[0]), name: names[0],
            emails: uniq(g.map((x) => x.email)), phones: uniq(g.map((x) => x.phone)), icos: uniq(g.map((x) => x.ico)),
            clientIds: g.flatMap((x) => (x.clientId ? [x.clientId] : [])), contactIds: g.flatMap((x) => (x.contactId ? [x.contactId] : [])),
            appearances: g.flatMap((x) => (x.ap ? [x.ap] : [])),
        };
    }).sort((a, b) => b.appearances.length - a.appearances.length || a.name.localeCompare(b.name, 'cs'));
}

// K jaké věci e-mail patří: pořadí věcí podle adresy klienta, spisové značky a názvu v předmětu nebo textu.
export type CaseLite = { id: string; title: string; client_id: string | null; client_email: string | null; client_name: string | null; reference?: string | null; status?: string };
export type ClientLite = { id: string; email: string; name?: string };
export type Match = { caseId: string; score: number; reason: string };

const FREE = new Set(['gmail.com', 'seznam.cz', 'email.cz', 'centrum.cz', 'post.cz', 'volny.cz', 'atlas.cz', 'outlook.com', 'outlook.cz', 'hotmail.com', 'live.com', 'icloud.com', 'yahoo.com', 'yahoo.cz', 'proton.me', 'protonmail.com', 'tiscali.cz', 'quick.cz', 'azet.sk', 'zoznam.sk']);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const emailsIn = (s: string) => [...s.toLowerCase().matchAll(/[^\s,;<>()"']+@[^\s,;<>()"']+\.[a-z]{2,}/g)].map((m) => m[0]);
const domain = (e: string) => e.split('@')[1] ?? '';
const normRef = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '');

export function matchCases(msg: { counterparty: string; subject: string; text: string }, cases: CaseLite[], clients: ClientLite[]): Match[] {
    const addrs = emailsIn(msg.counterparty); const subj = fold(msg.subject); const subjRef = normRef(msg.subject); const bodyRef = normRef(msg.text.slice(0, 6000));
    const emailOf = (c: CaseLite) => [c.client_email, clients.find((cl) => cl.id === c.client_id)?.email].filter((x): x is string => !!x).map((x) => x.toLowerCase());
    const out: Match[] = [];
    for (const c of cases) {
        let score = 0; let reason = '';
        const bump = (s: number, r: string) => { if (s > score) { score = s; reason = r; } };
        const mails = emailOf(c);
        if (mails.some((m) => addrs.includes(m))) bump(100, 'adresa klienta');
        else if (mails.some((m) => addrs.some((a) => domain(a) === domain(m) && !FREE.has(domain(a))))) bump(40, 'firma klienta');
        const ref = c.reference ? normRef(c.reference) : '';
        if (ref.length >= 5) { if (subjRef.includes(ref)) bump(90, 'spisová značka v předmětu'); else if (bodyRef.includes(ref)) bump(70, 'spisová značka v textu'); }
        const name = c.client_name ? fold(c.client_name).trim() : '';
        if (name.length >= 5 && subj.includes(name)) bump(30, 'jméno klienta v předmětu');
        const title = fold(c.title).trim();
        if (title.length >= 5 && subj.includes(title)) bump(25, 'název věci v předmětu');
        if (score > 0) out.push({ caseId: c.id, score: c.status && c.status !== 'open' ? Math.round(score / 2) : score, reason: c.status && c.status !== 'open' ? `${reason} (věc je vyřešená)` : reason });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

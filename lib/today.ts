// Pracovní přehled „Dnes“: čisté funkce, které z existujících dat (věci, lhůty, poptávky, zprávy klientů,
// žádosti o podklady, podpisy, výkazy) sestaví tři bloky. Žádná data neukládá a nic nepočítá jako závaznou lhůtu.
import { collectDeadlines, type CaseDeadline } from './caseFile';
import { daysUntil, type LegalCase } from './cases';
import { entryAmount, type TimeEntry } from './lawyer';

export type Urgency = 'overdue' | 'today' | 'soon' | 'later';
export type AgendaItem = {
    key: string; caseId: string; caseTitle: string; clientName: string;
    title: string; iso: string; left: number; urgency: Urgency;
    kind: 'lhuta' | 'ukol'; source: 'law' | 'custom'; confirmed: boolean;
    assigneeId: string | null; customId?: string; lawKey?: string | null; ownerId?: string;
};

export const AGENDA_DAYS = 14;
// Prošlé položky ukazujeme jen nedávné, aby přehled nezahltily staré vypočtené lhůty uzavřených etap
export const OVERDUE_DAYS = 30;

export function urgencyOf(left: number): Urgency {
    if (left < 0) return 'overdue';
    if (left === 0) return 'today';
    if (left <= 3) return 'soon';
    return 'later';
}

const RANK: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, later: 3 };

export function buildAgenda(cases: LegalCase[], customs: CaseDeadline[], opts: { now?: Date; days?: number; me?: string; onlyMine?: boolean } = {}): AgendaItem[] {
    const now = opts.now ?? new Date();
    const days = opts.days ?? AGENDA_DAYS;
    const out: AgendaItem[] = [];
    for (const c of cases) {
        if (c.status !== 'open') continue;
        for (const d of collectDeadlines(c, customs.filter((x) => x.case_id === c.id))) {
            if (d.done) continue;
            const left = daysUntil(d.date, now);
            if (left > days || left < -OVERDUE_DAYS) continue;
            // Vypočtené lhůty, které už uplynuly, nejsou úkol k vyřízení (nevíme, jestli se nepodalo); vlastní záznamy ano
            if (d.source === 'law' && left < 0) continue;
            out.push({
                key: `${c.id}:${d.key}`, caseId: c.id, caseTitle: c.title, clientName: c.client_name ?? '',
                title: d.title, iso: d.iso, left, urgency: urgencyOf(left),
                kind: d.kind, source: d.source, confirmed: d.confirmed,
                assigneeId: d.assigneeId ?? null, customId: d.customId, lawKey: d.lawKey ?? null, ownerId: c.user_id,
            });
        }
    }
    const mine = (a: AgendaItem) => !opts.me || (a.assigneeId ?? a.ownerId ?? opts.me) === opts.me;
    return out
        .filter((a) => !opts.onlyMine || mine(a))
        .sort((a, b) => RANK[a.urgency] - RANK[b.urgency] || a.left - b.left
            // Ve stejný den nejdřív lhůty, mezi nimi nepotvrzené
            || (a.kind === b.kind ? 0 : a.kind === 'lhuta' ? -1 : 1)
            || Number(a.confirmed) - Number(b.confirmed)
            || a.caseTitle.localeCompare(b.caseTitle, 'cs'));
}

// ---------- Nové věci k vyřízení ----------
export type InquiryRow = { id: string; name: string; message: string; status: 'new' | 'accepted' | 'declined'; created_at: string; case_id?: string | null };
export type MessageRow = { case_id: string; from_client: boolean; read: boolean; created_at: string };
export type RequestRow = { id: string; case_id: string; title: string; done: boolean; created_at: string };
export type UploadRow = { case_id: string; request_id: string | null; created_at: string; source?: string };
export type SignatureRow = { id: string; case_id: string; title: string; status: string; created_at: string; signed_at?: string | null };

export type InboxKind = 'poptavka' | 'zprava' | 'podklady' | 'podpis';
export type InboxItem = { key: string; kind: InboxKind; title: string; detail: string; at: string; href: string; caseId?: string; inquiryId?: string; action: string };

const caseHref = (id: string, tab?: string) => `/kancelar/veci/${id}?${tab ? `tab=${tab}&` : ''}from=dnes`;

export function buildInbox(input: { cases: LegalCase[]; inquiries: InquiryRow[]; messages: MessageRow[]; requests: RequestRow[]; uploads: UploadRow[]; signatures: SignatureRow[] }): InboxItem[] {
    const title = (id: string) => input.cases.find((c) => c.id === id)?.title ?? 'Spis';
    const items: InboxItem[] = [];
    for (const q of input.inquiries) {
        if (q.status === 'new') items.push({ key: `q-${q.id}`, kind: 'poptavka', title: `Poptávka: ${q.name}`, detail: q.message.slice(0, 140), at: q.created_at, href: `/kancelar/poptavky?open=${q.id}`, inquiryId: q.id, action: 'Rozhodnout' });
        // Přijatá poptávka bez spisu (např. když se spis nepodařilo navázat) je slepý konec: nabídneme dořešení
        else if (q.status === 'accepted' && !q.case_id) items.push({ key: `q-${q.id}`, kind: 'poptavka', title: `Přijatá poptávka bez spisu: ${q.name}`, detail: 'Poptávka nemá přiřazený spis.', at: q.created_at, href: `/kancelar/poptavky?open=${q.id}`, inquiryId: q.id, action: 'Přiřadit ke spisu' });
    }
    // Nepřečtené zprávy od klienta: jedna položka za věc
    const unread = new Map<string, { n: number; at: string }>();
    for (const m of input.messages) {
        if (!m.from_client || m.read) continue;
        const cur = unread.get(m.case_id);
        unread.set(m.case_id, { n: (cur?.n ?? 0) + 1, at: !cur || m.created_at > cur.at ? m.created_at : cur.at });
    }
    for (const [caseId, u] of unread) items.push({ key: `m-${caseId}`, kind: 'zprava', title: `Zpráva od klienta · ${title(caseId)}`, detail: u.n === 1 ? '1 nepřečtená zpráva' : `${u.n} nepřečtené zprávy`, at: u.at, href: caseHref(caseId, 'klient'), caseId, action: 'Přečíst' });
    // Klient nahrál podklady k žádosti, která ještě není odškrtnutá: zkontrolovat
    for (const r of input.requests) {
        if (r.done) continue;
        const ups = input.uploads.filter((u) => u.request_id === r.id);
        if (!ups.length) continue;
        const at = ups.map((u) => u.created_at).sort().pop()!;
        items.push({ key: `r-${r.id}`, kind: 'podklady', title: `Klient poslal podklady · ${title(r.case_id)}`, detail: `K žádosti „${r.title}“ (${ups.length} ${ups.length === 1 ? 'soubor' : ups.length < 5 ? 'soubory' : 'souborů'})`, at, href: caseHref(r.case_id, 'klient'), caseId: r.case_id, action: 'Zkontrolovat' });
    }
    // Podepsáno, ale advokát ještě nezkontroloval (podpis s kontrolou advokátem)
    for (const s of input.signatures) {
        if (s.status !== 'awaiting_check') continue;
        items.push({ key: `s-${s.id}`, kind: 'podpis', title: `Podpis ke kontrole · ${title(s.case_id)}`, detail: s.title, at: s.signed_at ?? s.created_at, href: caseHref(s.case_id, 'podpisy'), caseId: s.case_id, action: 'Zkontrolovat' });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- Čekání na klienta ----------
export type WaitReason = { kind: 'podklady' | 'podpis' | 'odpoved'; title: string; since: string };
export type WaitingItem = { caseId: string; caseTitle: string; clientName: string; reasons: WaitReason[]; days: number };

// Odpověď klienta čekáme, když poslední zprávu ve věci napsal advokát a je starší než tento počet dní
export const REPLY_AFTER_DAYS = 2;

export function buildWaiting(input: { cases: LegalCase[]; requests: RequestRow[]; uploads: UploadRow[]; signatures: SignatureRow[]; messages: MessageRow[]; now?: Date }): WaitingItem[] {
    const now = input.now ?? new Date();
    const age = (iso: string) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
    const byCase = new Map<string, WaitReason[]>();
    const add = (caseId: string, r: WaitReason) => byCase.set(caseId, [...(byCase.get(caseId) ?? []), r]);
    for (const r of input.requests) {
        if (r.done || input.uploads.some((u) => u.request_id === r.id)) continue;
        add(r.case_id, { kind: 'podklady', title: r.title, since: r.created_at });
    }
    for (const s of input.signatures) if (s.status === 'pending') add(s.case_id, { kind: 'podpis', title: s.title, since: s.created_at });
    const last = new Map<string, MessageRow>();
    for (const m of input.messages) { const cur = last.get(m.case_id); if (!cur || m.created_at > cur.created_at) last.set(m.case_id, m); }
    for (const [caseId, m] of last) if (!m.from_client && age(m.created_at) >= REPLY_AFTER_DAYS) add(caseId, { kind: 'odpoved', title: 'Odpověď na vaši zprávu', since: m.created_at });
    const out: WaitingItem[] = [];
    for (const [caseId, reasons] of byCase) {
        const c = input.cases.find((x) => x.id === caseId);
        if (!c || c.status !== 'open') continue;
        out.push({ caseId, caseTitle: c.title, clientName: c.client_name ?? '', reasons, days: Math.max(...reasons.map((r) => age(r.since))) });
    }
    return out.sort((a, b) => b.days - a.days);
}

// ---------- Nevyúčtovaný čas ----------
export type UnbilledCase = { caseId: string | null; caseTitle: string; minutes: number; amount: number; count: number; oldest: string };

export function buildUnbilled(entries: TimeEntry[], cases: LegalCase[]): UnbilledCase[] {
    const map = new Map<string, UnbilledCase>();
    for (const e of entries) {
        if (e.billed) continue;
        const k = e.case_id ?? '';
        const cur = map.get(k) ?? { caseId: e.case_id, caseTitle: e.case_id ? cases.find((c) => c.id === e.case_id)?.title ?? 'Spis' : 'Bez spisu', minutes: 0, amount: 0, count: 0, oldest: e.entry_date };
        cur.minutes += e.minutes; cur.amount += entryAmount(e); cur.count += 1;
        if (e.entry_date < cur.oldest) cur.oldest = e.entry_date;
        map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount || b.minutes - a.minutes);
}

// ---------- Zdroje příchozích věcí ----------
export type SourceState = 'ok' | 'off' | 'missing';
export type Source = { id: string; label: string; state: SourceState; note: string; href: string };

export function describeSources(s: { inquiries: boolean; portal: boolean; isds: number | null; mail: number | null }): Source[] {
    const conn = (n: number | null, label: string, id: string, href: string, okNote: string): Source =>
        n === null ? { id, label, state: 'missing', note: 'Funkce není v databázi zapnutá (chybí SQL).', href }
            : n > 0 ? { id, label, state: 'ok', note: okNote, href }
                : { id, label, state: 'off', note: 'Není nastaveno.', href };
    return [
        s.inquiries ? { id: 'poptavky', label: 'Poptávky', state: 'ok', note: 'Formulář pro zájemce funguje.', href: '/kancelar/poptavky' } : { id: 'poptavky', label: 'Poptávky', state: 'missing', note: 'Funkce není v databázi zapnutá (chybí SQL).', href: '/kancelar/poptavky' },
        s.portal ? { id: 'klient', label: 'Klientské stránky', state: 'ok', note: 'Zprávy a podklady od klientů se ukazují tady.', href: '/kancelar/veci' } : { id: 'klient', label: 'Klientské stránky', state: 'missing', note: 'Funkce není v databázi zapnutá (chybí SQL).', href: '/kancelar/veci' },
        // Datovky a e-maily se stahují až po odemčení přístupových údajů, aplikace je na pozadí nečte
        conn(s.isds, 'Datová schránka', 'schranka', s.isds ? '/kancelar/schranka' : '/kancelar/nastaveni', 'Připojená. Nové zprávy uvidíte po otevření schránky.'),
        conn(s.mail, 'E-mail', 'email', s.mail ? '/kancelar/email' : '/kancelar/nastaveni', 'Připojený. Nové e-maily uvidíte po otevření pošty.'),
    ];
}

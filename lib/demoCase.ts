// Ukázkový spis pro nové uživatele: vyplněná věc s klientem, kontakty, lhůtami, chronologií, časem a rozpočtem, aby první dojem nebyl prázdná obrazovka.
// Všechno je označené „Ukázka“ a jde smazat jako každá jiná věc.
import { supabase } from './supabase';
import { BLANK_CASE, createCase, type NewCase } from './cases';
import { insertRow } from './caseFile';
import { createDraftInvoice } from './invoiceDraft';

const iso = (offsetDays: number) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const DEMO_TITLE = 'Ukázka: Novák proti Dvořákovi (smlouva o dílo)';
export { DEMO_CASE_PREFIX, DEMO_MARK, DEMO_CASE_LIKE, DEMO_MARK_LIKE, isDemoTitle, isDemoName } from './demoMarks';
import { DEMO_MARK } from './demoMarks';

export const DEMO_PLAN = {
    deadlines: [{ title: 'Odpověď na výzvu protistrany', offset: 4 }, { title: 'Podání žaloby k soudu', offset: 21 }],
    contacts: [
        { role: 'Klient', name: 'Jan Novák (ukázka)', email: 'novak@example.cz', phone: '+420 777 000 111', note: 'Fiktivní osoba pro vyzkoušení.' },
        { role: 'Protistrana', name: 'Petr Dvořák (ukázka)', email: 'dvorak@example.cz', phone: '+420 777 000 222', note: '' },
        { role: 'Soud', name: 'Okresní soud v Plzni', email: '', phone: '', note: '' },
    ],
    entries: [
        { kind: 'event' as const, title: 'První schůzka s klientem', body: 'Klient popsal spor o zaplacení díla ve výši 80 000 Kč. Domluveno předání podkladů.', offset: -9 },
        { kind: 'note' as const, title: 'Podklady od klienta', body: 'Smlouva o dílo, fotodokumentace a e-mailová komunikace. Zkontrolovat promlčení.', offset: -6 },
        { kind: 'event' as const, title: 'Odeslána výzva k plnění', body: 'Předžalobní výzva odeslána protistraně, lhůta 7 dní.', offset: -3 },
    ],
    time: [{ minutes: 90, description: 'Schůzka s klientem a analýza smlouvy', offset: -9 }, { minutes: 120, description: 'Rešerše a příprava výzvy', offset: -6 }, { minutes: 45, description: 'Komunikace s protistranou', offset: -2 }],
    steps: ['Převzít podklady od klienta', 'Odeslat předžalobní výzvu', 'Připravit žalobu', 'Podat žalobu'],
};

// Založí ukázkovou věc (a k ní klienta v adresáři a koncept vyúčtování) a vrátí její id. Když už ukázka existuje, vrátí tu.
export async function createDemoCase(userId: string, rate: number, opts: { vatRate?: number } = {}): Promise<string> {
    const { data: existing } = await supabase.from('cases').select('id').eq('user_id', userId).eq('title', DEMO_TITLE).limit(1);
    if (existing?.length) return (existing[0] as { id: string }).id;
    // Klient do adresáře (když tabulka chybí nebo zápis selže, ukázka vznikne i bez něj)
    let clientId: string | null = null;
    try {
        const { data: cl } = await supabase.from('lawyer_clients').insert({ user_id: userId, name: 'Jan Novák (ukázka)', email: 'novak@example.cz', phone: '+420 777 000 111', address: 'Ukázková 12, 301 00 Plzeň', note: 'Fiktivní klient pro vyzkoušení. Klidně ho smažte.' }).select('id').single();
        clientId = (cl as { id: string } | null)?.id ?? null;
    } catch { clientId = null; }
    const input = {
        ...BLANK_CASE, title: DEMO_TITLE, summary: 'Ukázkový spis. Projděte si záložky a pak ho klidně smažte.',
        steps: DEMO_PLAN.steps.map((text, i) => ({ text, done: i < 2 })),
        client_name: 'Jan Novák (ukázka)', client_email: 'novak@example.cz', client_phone: '+420 777 000 111',
        reference: '12 C 345/2026', authority: 'Okresní soud v Plzni', client_id: clientId,
        // Rozšířené sloupce (migrace 27 a 28) databáze přijme jen když existují; bez nich se založí základní věc
    } as unknown as NewCase;
    let id: string;
    try {
        const c = await createCase(userId, { ...input, case_type: 'Občanskoprávní', labels: ['Ukázka'], budget_czk: 25000 } as unknown as NewCase);
        id = c.id;
    } catch {
        id = (await createCase(userId, input)).id;
    }
    await Promise.all([
        ...DEMO_PLAN.deadlines.map((d) => insertRow('case_deadlines', { case_id: id, user_id: userId, title: d.title, due_date: iso(d.offset), done: false })),
        ...DEMO_PLAN.contacts.map((c) => insertRow('case_contacts', { case_id: id, user_id: userId, ...c })),
        ...DEMO_PLAN.entries.map((e) => insertRow('case_entries', { case_id: id, user_id: userId, kind: e.kind, title: e.title, body: e.body, happened_on: iso(e.offset) })),
        ...DEMO_PLAN.time.map((t) => supabase.from('time_entries').insert({ user_id: userId, case_id: id, entry_date: iso(t.offset), minutes: t.minutes, description: `${t.description} ${DEMO_MARK}`, rate }).then(({ error }) => { if (error) throw new Error(error.message); })),
    ]);
    // Koncept vyúčtování z vykázaného času (ukazuje fakturaci); nepovinné
    try {
        await createDraftInvoice({
            userId, title: 'Ukázka: Vyúčtování Novák proti Dvořákovi', caseId: id, clientId,
            lines: DEMO_PLAN.time.map((t) => ({ description: `${t.description} ${DEMO_MARK}`, qty: Math.round((t.minutes / 60) * 100) / 100, unit: 'hod', unit_price: rate, vat_rate: opts.vatRate ?? 21 })),
        });
    } catch { /* bez fakturace ukázka zůstane jen se spisem */ }
    return id;
}

import { supabase } from './supabase';
import { decryptText } from './e2ee';
import { loadReceivables, round2, todayIso, type Receivable } from './billing';
import { planBatch, vsOf, type BankTx, type Decision, type OpenInvoice } from './bank';

// Evidence plateb: jediné místo pravdy je invoice_payments. Bankovní pohyb se na platbu jen odkazuje.
export type Account = { id: string; label: string; provider: 'fio' | 'csv'; iban: string; enc_token: string | null; auto_match: boolean; last_sync_at: string | null; last_error: string };
export type TxRow = { id: string; account_id: string; txid: string; tx_date: string; amount: number; currency: string; vs: string; counterparty: string; account_no: string; bank_code: string; message: string; status: 'new' | 'matched' | 'ignored'; invoice_id: string | null; payment_id: string | null; matched_by: string; note: string };

const OPEN_STATES = ['open', 'partial', 'due_soon', 'overdue'];
export const toOpen = (r: Receivable): OpenInvoice => ({ id: r.id, number: r.number ?? '', vs: vsOf(r.number ?? ''), outstanding: r.outstanding, currency: r.currency, client: r.client_snapshot.name ?? '', due: r.due_date });
export const openInvoices = (all: Receivable[]) => all.filter((r) => OPEN_STATES.includes(r.state) && r.number).map(toOpen);

// Zapíše platbu k vyúčtování a srovná jeho stav (zaplaceno, když součet plateb dosáhne částky)
export async function recordPayment(userId: string, inv: Pick<Receivable, 'id' | 'total' | 'paid' | 'status'>, amount: number, date: string, note: string): Promise<string> {
    const { data, error } = await supabase.from('invoice_payments').insert({ invoice_id: inv.id, user_id: userId, amount: round2(amount), paid_on: date, note: note.slice(0, 300) }).select('id').single();
    if (error) throw new Error(/invoice_payments|relation|does not exist/i.test(error.message) ? 'Platby zatím nejsou v databázi zapnuté (chybí spuštění souboru platby.sql).' : error.message);
    if (round2(inv.paid + amount) >= inv.total - 0.004 && inv.total > 0 && inv.status !== 'paid') await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id);
    return (data as { id: string }).id;
}

// Po smazání platby se vyúčtování vrátí mezi nezaplacená, pokud už není uhrazené celé
export async function resyncInvoiceStatus(invoiceId: string, vatNow: boolean) {
    const all = await loadReceivables(vatNow);
    const r = all.find((x) => x.id === invoiceId);
    if (!r || r.status === 'draft' || r.status === 'cancelled') return;
    const paid = r.paid;
    if (r.status === 'paid' && paid < r.total - 0.004) await supabase.from('invoices').update({ status: 'issued', paid_at: null }).eq('id', invoiceId);
    else if (r.status !== 'paid' && paid >= r.total - 0.004 && r.total > 0) await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId);
}

const toRow = (t: BankTx, userId: string, accountId: string) => ({ user_id: userId, account_id: accountId, txid: t.txid, tx_date: t.date, amount: t.amount, currency: t.currency || 'CZK', vs: t.vs, ks: t.ks, ss: t.ss, counterparty: t.counterparty.slice(0, 300), account_no: t.account, bank_code: t.bankCode, message: t.message.slice(0, 600), tx_type: t.type, status: 'new' as const });

export type ImportSummary = { added: number; duplicates: number; auto: number; suggest: number; overpay: number; none: number };

// Uloží stažené pohyby (už známé se přeskočí) a hned zpracuje nové příchozí platby
export async function storeTransactions(userId: string, account: Account, txs: BankTx[], vatNow: boolean): Promise<ImportSummary> {
    let added = 0;
    for (let i = 0; i < txs.length; i += 200) {
        const chunk = txs.slice(i, i + 200);
        const { data, error } = await supabase.from('bank_transactions').upsert(chunk.map((t) => toRow(t, userId, account.id)), { onConflict: 'account_id,txid', ignoreDuplicates: true }).select('id');
        if (error) throw new Error(/bank_transactions|relation|does not exist/i.test(error.message) ? 'Banka zatím není v databázi zapnutá (chybí spuštění souboru platby-banka.sql).' : error.message);
        added += (data ?? []).length;
    }
    const proc = await processNew(userId, vatNow, account.auto_match);
    return { added, duplicates: txs.length - added, ...proc };
}

// Nové příchozí platby proti otevřeným vyúčtováním: podle variabilního symbolu se párují samy (když je automatika zapnutá)
export async function processNew(userId: string, vatNow: boolean, auto: boolean): Promise<Omit<ImportSummary, 'added' | 'duplicates'>> {
    const [{ data }, receivables] = await Promise.all([supabase.from('bank_transactions').select('*').eq('status', 'new').gt('amount', 0), loadReceivables(vatNow)]);
    const rows = ((data ?? []) as TxRow[]).map((r) => ({ ...r, amount: Number(r.amount) }));
    const txs: BankTx[] = rows.map((r) => ({ txid: r.id, date: r.tx_date, amount: r.amount, currency: r.currency, vs: r.vs, ks: '', ss: '', counterparty: r.counterparty, account: r.account_no, bankCode: r.bank_code, message: r.message, type: '' }));
    const plan = planBatch(txs, openInvoices(receivables));
    const sum = { auto: 0, suggest: 0, overpay: 0, none: 0 };
    const live = new Map(receivables.map((r) => [r.id, { ...r }]));
    for (const { tx, d } of plan) {
        if (d.kind === 'auto' && auto && d.invoiceId && d.apply) {
            const inv = live.get(d.invoiceId);
            if (!inv) { sum.none += 1; continue; }
            const row = rows.find((r) => r.id === tx.txid);
            const paymentId = await recordPayment(userId, inv, d.apply, tx.date, `Banka: ${tx.counterparty || 'platba'}${tx.vs ? `, VS ${tx.vs}` : ''}${d.confidence === 'vs' ? '' : ` (${d.reason})`}`);
            await supabase.from('bank_transactions').update({ status: 'matched', invoice_id: inv.id, payment_id: paymentId, matched_by: d.confidence === 'vs' ? 'vs' : 'auto' }).eq('id', row?.id ?? tx.txid);
            inv.paid = round2(inv.paid + d.apply); inv.outstanding = round2(inv.total - inv.paid);
            sum.auto += 1;
        } else if (d.kind === 'auto') sum.suggest += 1;
        else sum[d.kind] += 1;
    }
    return sum;
}

export async function assignTx(userId: string, tx: TxRow, inv: Receivable, amount: number, by: 'navrh' | 'rucne') {
    const paymentId = await recordPayment(userId, inv, amount, tx.tx_date, `Banka: ${tx.counterparty || 'platba'}${tx.vs ? `, VS ${tx.vs}` : ''}`);
    const { error } = await supabase.from('bank_transactions').update({ status: 'matched', invoice_id: inv.id, payment_id: paymentId, matched_by: by }).eq('id', tx.id);
    if (error) throw new Error(error.message);
}

export async function unmatchTx(tx: TxRow, vatNow: boolean) {
    if (tx.payment_id) { const { error } = await supabase.from('invoice_payments').delete().eq('id', tx.payment_id); if (error) throw new Error(error.message); }
    if (tx.invoice_id) await resyncInvoiceStatus(tx.invoice_id, vatNow);
}

export async function ignoreTx(id: string, note: string) { await supabase.from('bank_transactions').update({ status: 'ignored', note: note.slice(0, 300) }).eq('id', id); }
export async function restoreTx(id: string) { await supabase.from('bank_transactions').update({ status: 'new', note: '' }).eq('id', id); }

// Stažení z Fio: od posledního stažení (s rezervou 3 dnů), poprvé 30 dní zpět; token se dešifruje šifrovacím heslem a pošle na server na jedno volání
export async function syncFio(master: CryptoKey, userId: string, account: Account, vatNow: boolean, days = 30): Promise<ImportSummary> {
    if (!account.enc_token) throw new Error('Účet nemá uložený token.');
    const token = await decryptText(master, account.enc_token);
    const today = todayIso();
    const fromMs = account.last_sync_at ? Math.max(new Date(account.last_sync_at).getTime() - 3 * 86_400_000, Date.now() - 89 * 86_400_000) : Date.now() - days * 86_400_000;
    const from = new Date(fromMs).toISOString().slice(0, 10);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/bank', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ action: 'fio', token, from, to: today }) });
    const json = await res.json().catch(() => ({})) as { transactions?: BankTx[]; message?: string; iban?: string };
    if (!res.ok) { await supabase.from('bank_accounts').update({ last_error: json.message ?? 'Stažení se nepodařilo.' }).eq('id', account.id); throw new Error(json.message ?? 'Stažení se nepodařilo.'); }
    const summary = await storeTransactions(userId, account, json.transactions ?? [], vatNow);
    await supabase.from('bank_accounts').update({ last_sync_at: new Date().toISOString(), last_error: '', ...(json.iban && !account.iban ? { iban: json.iban } : {}) }).eq('id', account.id);
    return summary;
}

export type { Decision };

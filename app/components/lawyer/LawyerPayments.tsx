'use client';

import { isCamt, parseCamt053 } from '@/lib/camt';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Ban, Check, KeyRound, Landmark, Loader2, Plus, RefreshCw, Trash2, Undo2, Upload, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { encryptText } from '@/lib/e2ee';
import { useMasterKey } from '@/lib/useE2ee';
import { money, parseAmount, round2, todayIso, loadReceivables, type Receivable } from '@/lib/billing';
import { decide, parseBankCsv, type BankTx } from '@/lib/bank';
import { assignTx, ignoreTx, openInvoices, recordPayment, restoreTx, storeTransactions, syncFio, unmatchTx, type Account, type ImportSummary, type TxRow } from '@/lib/payments';
import { autoSyncBanks } from '@/lib/bankSync';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import RemindersPanel from './RemindersPanel';

const dateCz = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('cs-CZ');
const summaryText = (s: ImportSummary) => `Nových pohybů ${s.added}${s.duplicates ? ` (${s.duplicates} už znám)` : ''}. Spárováno automaticky: ${s.auto}. K potvrzení (nejasné případy): ${s.suggest + s.overpay}. Bez návrhu: ${s.none}.`;

// Platby na jednom místě: účet, nespárované příchozí platby, rychlý zápis, spárované platby a upomínky
export default function LawyerPayments() {
    const { userId, access } = useLawyer();
    const master = useMasterKey();
    const vat = !!access.vat_payer;
    const [accounts, setAccounts] = useState<Account[] | null | undefined>(undefined);
    const [txs, setTxs] = useState<TxRow[]>([]);
    const [invoices, setInvoices] = useState<Receivable[]>([]);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const [a, t, r] = await Promise.all([supabase.from('bank_accounts').select('*').order('created_at'), supabase.from('bank_transactions').select('*').order('tx_date', { ascending: false }).limit(400), loadReceivables(vat).catch(() => [] as Receivable[])]);
        if (a.error) { setAccounts(null); setError(/bank_accounts|schema cache|does not exist/i.test(a.error.message) ? 'Banka zatím není v databázi zapnutá (chybí spuštění souboru platby-banka.sql).' : a.error.message); return; }
        setAccounts((a.data ?? []) as Account[]);
        setTxs(((t.data ?? []) as TxRow[]).map((x) => ({ ...x, amount: Number(x.amount) })));
        setInvoices(r);
    }, [vat]);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);
    useEffect(() => { const on = () => void load(); window.addEventListener('bank-sync', on); return () => window.removeEventListener('bank-sync', on); }, [load]);
    // Při otevření se nové platby tiše stáhnou
    useEffect(() => { if (master) void autoSyncBanks(userId, vat); }, [master, userId, vat]);

    const open = useMemo(() => openInvoices(invoices), [invoices]);
    const incoming = txs.filter((t) => t.amount > 0);
    const todo = incoming.filter((t) => t.status === 'new');
    const matched = incoming.filter((t) => t.status === 'matched');
    const ignored = incoming.filter((t) => t.status === 'ignored');

    async function run(key: string, fn: () => Promise<void>) { setBusy(key); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se.'); } setBusy(''); await load(); }

    if (accounts === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (accounts === null) return <p role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">{error}</p>;

    return (
        <div className="space-y-6">
            {msg && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{msg}</p>}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            <Unmatched todo={todo} open={open} invoices={invoices} userId={userId} vat={vat} busy={busy} run={run} />
            <BankPanel accounts={accounts} master={master} userId={userId} vat={vat} busy={busy} run={run} setMsg={setMsg} />
            <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700">Klient zaplatil mimo banku (hotově, z jiného účtu)</summary><div className="border-t border-slate-100"><QuickPayment invoices={invoices} userId={userId} onDone={async (t) => { setMsg(t); setError(''); await load(); }} onError={setError} /></div></details>
            <RemindersPanel invoices={invoices} userId={userId} onChanged={load} />

            {matched.length > 0 && (
                <section aria-label="Spárované platby"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Spárované platby z banky ({matched.length})</h2>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">{matched.slice(0, 20).map((t) => { const inv = invoices.find((i) => i.id === t.invoice_id); return (
                        <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5"><span className="w-20 shrink-0 text-xs text-slate-500">{dateCz(t.tx_date)}</span><span className="min-w-0 flex-1 truncate text-slate-800">{t.counterparty || 'platba'}{t.vs && <span className="ml-1.5 text-xs text-slate-400">VS {t.vs}</span>}</span><span className="shrink-0 font-semibold text-emerald-800">{money(t.amount, t.currency === 'EUR' ? 'EUR' : 'CZK')}</span>{inv && <Link href={`/kancelar/faktury/${inv.id}`} className="shrink-0 text-xs font-semibold text-indigo-800 hover:underline">→ {inv.number}</Link>}<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{t.matched_by === 'vs' || t.matched_by === 'auto' ? 'automaticky' : 'ručně'}</span>
                            <button type="button" onClick={() => void run(`un-${t.id}`, async () => { await unmatchTx(t, vat); setMsg('Spárování zrušeno, platba se vrátila mezi nespárované.'); })} aria-label="Zrušit spárování" title="Zrušit spárování" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><Undo2 size={14} /></button></li>
                    ); })}</ul>
                </section>
            )}
            {ignored.length > 0 && (
                <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">Ignorované platby ({ignored.length})</summary>
                    <ul className="mt-2 divide-y divide-slate-100">{ignored.slice(0, 30).map((t) => <li key={t.id} className="flex items-center gap-3 py-2"><span className="w-20 shrink-0 text-xs text-slate-500">{dateCz(t.tx_date)}</span><span className="min-w-0 flex-1 truncate text-slate-700">{t.counterparty || 'platba'} · {money(t.amount)}</span><button type="button" onClick={() => void run(`rs-${t.id}`, () => restoreTx(t.id))} className={ghostBtn}>Vrátit k vyřízení</button></li>)}</ul>
                </details>
            )}
        </div>
    );
}

// Jednoduchý zápis platby bez banky (hotově, jiný účet): dvě kliknutí
function QuickPayment({ invoices, userId, onDone, onError }: { invoices: Receivable[]; userId: string; onDone: (m: string) => Promise<void>; onError: (m: string) => void }) {
    const unpaid = invoices.filter((i) => ['open', 'partial', 'due_soon', 'overdue'].includes(i.state));
    const [id, setId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(todayIso());
    const [how, setHow] = useState('převodem');
    const [busy, setBusy] = useState(false);
    const inv = unpaid.find((i) => i.id === id);
    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!inv) return;
        const a = amount.trim() ? parseAmount(amount) : inv.outstanding;
        if (a === null || a <= 0) { onError('Zadejte částku.'); return; }
        setBusy(true);
        try { await recordPayment(userId, inv, a, date || todayIso(), `Zapsáno ručně (${how})`); setId(''); setAmount(''); await onDone(`Platba ${money(a, inv.currency)} je zapsaná u ${inv.number}${round2(inv.outstanding - a) <= 0.004 ? ', vyúčtování je zaplacené.' : `, zbývá ${money(round2(inv.outstanding - a), inv.currency)}.`}`); }
        catch (err) { onError(err instanceof Error ? err.message : 'Platbu se nepodařilo zapsat.'); }
        setBusy(false);
    }
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Zapsat platbu">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Plus size={18} className="text-indigo-700" /> Zapsat platbu mimo banku</h2>
            <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
                <label className="block text-xs font-semibold text-slate-600">Vyúčtování<select value={id} onChange={(e) => { setId(e.target.value); setAmount(''); }} className={`${inputCls} mt-1 font-normal`}><option value="">Vyberte neuhrazené…</option>{unpaid.map((i) => <option key={i.id} value={i.id}>{i.number} · {i.client_snapshot.name ?? i.title} · zbývá {money(i.outstanding, i.currency)}</option>)}</select></label>
                <label className="block text-xs font-semibold text-slate-600">Částka<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={inv ? String(inv.outstanding).replace('.', ',') : ''} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="block text-xs font-semibold text-slate-600">Datum<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="block text-xs font-semibold text-slate-600">Způsob<select value={how} onChange={(e) => setHow(e.target.value)} className={`${inputCls} mt-1 font-normal`}>{['převodem', 'hotově', 'kartou', 'jinak'].map((h) => <option key={h}>{h}</option>)}</select></label>
                <button type="submit" disabled={!inv || busy} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapsat</button>
            </form>
            <p className="mt-2 text-xs text-slate-500">Nechte částku prázdnou, pokud klient zaplatil celé zbývající vyúčtování. Platby z připojeného účtu se zapisují samy, tohle je jen pro to, co banka nevidí.</p>
        </section>
    );
}

function Unmatched({ todo, open, invoices, userId, vat, busy, run }: { todo: TxRow[]; open: ReturnType<typeof openInvoices>; invoices: Receivable[]; userId: string; vat: boolean; busy: string; run: (k: string, fn: () => Promise<void>) => Promise<void> }) {
    const [pick, setPick] = useState<Record<string, string>>({});
    if (todo.length === 0) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950" aria-label="K vyřízení"><Check size={15} className="mr-1.5 inline" /> Všechny příchozí platby jsou vyřízené.</section>;
    return (
        <section aria-label="Příchozí platby k vyřízení">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><AlertTriangle size={18} className="text-amber-600" /> K vyřízení ({todo.length})</h2>
            <p className="mt-0.5 text-xs text-slate-500">Příchozí platby, které se nepodařilo bezpečně spárovat samy. Potvrďte návrh, nebo vyberte vyúčtování.</p>
            <ul className="mt-3 space-y-3">
                {todo.map((t) => {
                    const d = decide({ txid: t.id, date: t.tx_date, amount: t.amount, currency: t.currency, vs: t.vs, ks: '', ss: '', counterparty: t.counterparty, account: t.account_no, bankCode: t.bank_code, message: t.message, type: '' }, open);
                    const sugg = d.invoiceId ? invoices.find((i) => i.id === d.invoiceId) : undefined;
                    const chosen = invoices.find((i) => i.id === pick[t.id]);
                    const apply = (inv: Receivable, amount: number, by: 'navrh' | 'rucne') => void run(`as-${t.id}`, () => assignTx(userId, t, inv, amount, by));
                    return (
                        <li key={t.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-lg font-bold text-emerald-800">{money(t.amount, t.currency === 'EUR' ? 'EUR' : 'CZK')}</p><p className="text-xs text-slate-500">{dateCz(t.tx_date)}</p></div>
                            <p className="mt-0.5 text-sm text-slate-800">{t.counterparty || 'bez názvu protistrany'}{t.account_no && <span className="text-xs text-slate-400"> · {t.account_no}{t.bank_code ? `/${t.bank_code}` : ''}</span>}</p>
                            <p className="text-xs text-slate-500">{t.vs ? `VS ${t.vs}` : 'bez variabilního symbolu'}{t.message ? ` · ${t.message}` : ''}</p>
                            {sugg && d.kind !== 'none' && (
                                <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950"><p>{d.reason}</p>
                                    <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={busy === `as-${t.id}`} onClick={() => apply(sugg, d.apply ?? Math.min(t.amount, sugg.outstanding), 'navrh')} className={primaryBtn}><Zap size={14} /> Přiřadit k {sugg.number}{d.kind === 'overpay' ? ` (${money(sugg.outstanding, sugg.currency)}, přeplatek zbude)` : ''}</button></div></div>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <select value={pick[t.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [t.id]: e.target.value }))} aria-label="Vyúčtování" className={`${inputCls} max-w-xs`}><option value="">Přiřadit k jinému vyúčtování…</option>{open.map((i) => <option key={i.id} value={i.id}>{i.number} · {i.client} · {money(i.outstanding, i.currency as 'CZK' | 'EUR')}</option>)}</select>
                                <button type="button" disabled={!chosen || busy === `as-${t.id}`} onClick={() => chosen && apply(chosen, Math.min(t.amount, chosen.outstanding), 'rucne')} className={ghostBtn}>Přiřadit</button>
                                <button type="button" onClick={() => { const n = window.prompt('Proč platba nepatří k vyúčtování? (nepovinné)', ''); if (n !== null) void run(`ig-${t.id}`, () => ignoreTx(t.id, n)); }} className={`${ghostBtn} ml-auto`}><Ban size={14} /> Není k vyúčtování</button>
                            </div>
                            {chosen && t.amount > chosen.outstanding + 0.004 && <p className="mt-1.5 text-xs text-amber-900">Platba je vyšší než zbývá ({money(chosen.outstanding)}). Přiřadí se jen zbývající částka, přeplatek si řešte s klientem.</p>}
                        </li>
                    );
                })}
            </ul>
            <span className="hidden">{String(vat)}</span>
        </section>
    );
}

function BankPanel({ accounts, master, userId, vat, busy, run, setMsg }: { accounts: Account[]; master: CryptoKey | null; userId: string; vat: boolean; busy: string; run: (k: string, fn: () => Promise<void>) => Promise<void>; setMsg: (m: string) => void }) {
    const [form, setForm] = useState({ label: '', token: '' });
    const [showFio, setShowFio] = useState(false);
    const [csv, setCsv] = useState<{ name: string; txs: BankTx[]; skipped: number; missing: string[]; accountId: string } | null>(null);
    const file = useRef<HTMLInputElement>(null);

    async function connectFio(e: React.FormEvent) {
        e.preventDefault();
        if (!master) return;
        const token = form.token.trim();
        await run('fio', async () => {
            const from = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/bank', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ action: 'fio', token, from, to: todayIso() }) });
            const json = await res.json().catch(() => ({})) as { message?: string; iban?: string };
            if (!res.ok) throw new Error(json.message ?? 'Fio odmítlo token.');
            const enc = await encryptText(master, token);
            const { data, error } = await supabase.from('bank_accounts').insert({ user_id: userId, label: form.label.trim() || 'Fio banka', provider: 'fio', iban: json.iban ?? '', enc_token: enc }).select('*').single();
            if (error) throw new Error(error.message);
            setForm({ label: '', token: '' }); setShowFio(false);
            const s = await syncFio(master, userId, data as Account, vat, 60);
            setMsg(`Účet je připojený. ${summaryText(s)}`);
        });
    }

    async function pickFile(f: File | undefined) {
        if (!f) return;
        const text = await f.text();
        const r = isCamt(text) ? { ...parseCamt053(text, 'csv'), missing: [] as string[] } : parseBankCsv(text, 'csv');
        setCsv({ name: f.name, txs: r.txs, skipped: r.skipped, missing: r.missing, accountId: accounts.find((a) => a.provider === 'csv')?.id ?? 'new' });
    }
    async function importCsv() {
        if (!csv) return;
        await run('csv', async () => {
            let account = accounts.find((a) => a.id === csv.accountId);
            if (!account) { const { data, error } = await supabase.from('bank_accounts').insert({ user_id: userId, label: 'Účet z výpisů', provider: 'csv' }).select('*').single(); if (error) throw new Error(error.message); account = data as Account; }
            const acc = account;
            // ID pohybů v CSV mají předponu účtu, aby se stejný výpis nenahrál dvakrát
            const txs = csv.txs.map((t) => ({ ...t, txid: t.txid.replace(/^csv:/, `${acc.id.slice(0, 8)}:`) }));
            const s = await storeTransactions(userId, acc, txs, vat);
            setCsv(null); if (file.current) file.current.value = '';
            setMsg(`Výpis je nahraný. ${summaryText(s)}`);
        });
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Bankovní účet">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Landmark size={18} className="text-indigo-700" /> Bankovní účet</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Příchozí platby se samy spárují s vyúčtováním. Výpis z libovolné banky nahrajete jako CSV nebo XML (camt.053); u Fio banky lze účet připojit a platby se pak stahují samy. Token se ukládá zašifrovaný vaším šifrovacím heslem, server ho neukládá.</p>
            {accounts.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                    {accounts.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                            <span className="min-w-0 flex-1"><strong className="text-slate-900">{a.label}</strong><span className="block text-xs text-slate-500">{a.provider === 'fio' ? 'Fio API' : 'nahrané výpisy'}{a.iban ? ` · ${a.iban}` : ''} · {a.last_sync_at ? `staženo ${new Date(a.last_sync_at).toLocaleString('cs-CZ')}` : 'zatím nestaženo'}</span>{a.last_error && <span className="block text-xs font-semibold text-rose-800">{a.last_error}</span>}</span>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={a.auto_match} onChange={(e) => void run(`am-${a.id}`, async () => { await supabase.from('bank_accounts').update({ auto_match: e.target.checked }).eq('id', a.id); })} className="h-3.5 w-3.5 accent-indigo-800" /> párovat automaticky</label>
                            {a.provider === 'fio' && <button type="button" disabled={!master || busy === `sync-${a.id}`} onClick={() => master && void run(`sync-${a.id}`, async () => { setMsg(summaryText(await syncFio(master, userId, a, vat))); })} className={ghostBtn}>{busy === `sync-${a.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Stáhnout nyní</button>}
                            <button type="button" onClick={() => { if (window.confirm(`Odpojit účet „${a.label}“? Stažené pohyby se smažou, zapsané platby u vyúčtování zůstanou.`)) void run(`del-${a.id}`, async () => { await supabase.from('bank_accounts').delete().eq('id', a.id); }); }} aria-label="Odpojit účet" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={14} /></button>
                        </li>
                    ))}
                </ul>
            )}
            {!master && <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><KeyRound size={15} aria-hidden="true" /> Pro připojení a stahování odemkněte šifrovací heslo v Nastavení.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowFio((v) => !v)} disabled={!master} className={primaryBtn}><Plus size={15} /> Připojit účet u Fio banky</button>
                <button type="button" onClick={() => file.current?.click()} className={ghostBtn}><Upload size={14} /> Nahrát výpis z jakékoli banky (CSV nebo XML)</button>
                <input ref={file} type="file" accept=".csv,.xml,text/csv,text/plain,text/xml,application/xml" onChange={(e) => void pickFile(e.target.files?.[0])} className="sr-only" aria-label="Soubor s výpisem" />
            </div>
            {showFio && master && (
                <form onSubmit={connectFio} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4">
                    <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
                        <li>Přihlaste se do internetového bankovnictví Fio.</li>
                        <li>Otevřete <strong>Nastavení → API</strong> a zvolte <strong>Přidat nový token</strong>.</li>
                        <li>Vyberte účet a <strong>oprávnění „Pouze sledování účtu“</strong> (jen čtení, token nemůže platit). Platnost nastavte co nejdelší.</li>
                        <li>Vygenerovaný token vložte sem.</li>
                    </ol>
                    <div className="grid gap-2 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Název účtu<input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="např. Provozní účet" className={`${inputCls} mt-1 font-normal`} /></label><label className="block text-xs font-semibold text-slate-600">Token *<input type="password" value={form.token} onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))} required autoComplete="off" className={`${inputCls} mt-1 font-normal`} /></label></div>
                    <button type="submit" disabled={busy === 'fio' || form.token.trim().length < 40} className={primaryBtn}>{busy === 'fio' && <Loader2 size={15} className="animate-spin" />} Ověřit a připojit</button>
                </form>
            )}
            {csv && (
                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm">
                    <p className="font-semibold text-slate-900">{csv.name}: nalezeno {csv.txs.length} pohybů ({csv.txs.filter((t) => t.amount > 0).length} příchozích){csv.skipped ? `, ${csv.skipped} řádků přeskočeno` : ''}.</p>
                    {csv.missing.length > 0 && <p role="alert" className="mt-1 text-rose-800">Ve výpisu chybí sloupec: {csv.missing.join(', ')}. Zkontrolujte, že jde o export pohybů s hlavičkou.</p>}
                    {csv.txs.length > 0 && <p className="mt-1 text-xs text-slate-600">Období {dateCz([...csv.txs].sort((a, b) => a.date.localeCompare(b.date))[0].date)} až {dateCz([...csv.txs].sort((a, b) => b.date.localeCompare(a.date))[0].date)}. Už nahrané pohyby se přeskočí.</p>}
                    <div className="mt-2 flex gap-2"><button type="button" onClick={() => void importCsv()} disabled={csv.txs.length === 0 || busy === 'csv'} className={primaryBtn}>{busy === 'csv' && <Loader2 size={15} className="animate-spin" />} Nahrát a spárovat</button><button type="button" onClick={() => { setCsv(null); if (file.current) file.current.value = ''; }} className={ghostBtn}>Zrušit</button></div>
                </div>
            )}
        </section>
    );
}

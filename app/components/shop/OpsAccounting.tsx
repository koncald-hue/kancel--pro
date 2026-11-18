'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FilePlus2, Loader2, Printer, ReceiptText, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import { CATEGORY_LABEL, SOURCE_LABEL, cashBook, cashBookCsv, expensesCsv, invoiceHtml, invoicesCsv, monthly, round2, type OpsExpense, type OpsInvoice } from '@/lib/opsBooks';

type Settings = { name: string; address: string; ico: string; dic: string; vat_payer: boolean; vat_rate: number; bank_account: string; email: string; register_note: string; prefix: string; due_days: number };
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const ghost = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer';
const primary = 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer';
const kc = (n: number) => `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)} Kč`;
const dmy = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');
const today = () => new Date().toISOString().slice(0, 10);
const monthName = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
function download(name: string, text: string, type = 'text/csv;charset=utf-8') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

// Účetnictví provozovatele: faktury vznikají samy při zaplacení objednávky, výdaje se zapisují ručně, výstupy pro účetní
export default function OpsAccounting() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [invoices, setInvoices] = useState<OpsInvoice[]>([]);
    const [expenses, setExpenses] = useState<OpsExpense[]>([]);
    const [missing, setMissing] = useState(false);
    const [year, setYear] = useState(Number(today().slice(0, 4)));
    const [tab, setTab] = useState<'prehled' | 'faktury' | 'vydaje' | 'nastaveni'>('prehled');
    const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
    const [exp, setExp] = useState({ spent_on: today(), supplier: '', description: '', category: 'ostatni', total: '', vat: '', doc_no: '' });
    const [manual, setManual] = useState<{ name: string; ico: string; address: string; email: string; description: string; total: string; paid: string } | null>(null);
    const [credit, setCredit] = useState<{ id: string; reason: string } | null>(null);

    const load = useCallback(async () => {
        const [s, i, e] = await Promise.all([
            supabase.from('ops_settings').select('*').eq('id', 1).maybeSingle(),
            supabase.from('ops_invoices').select('*').order('year', { ascending: false }).order('seq', { ascending: false }).limit(5000),
            supabase.from('ops_expenses').select('*').order('spent_on', { ascending: false }).limit(5000),
        ]);
        if (s.error) { if (/ops_settings|schema cache|does not exist/i.test(s.error.message)) setMissing(true); else setErr(s.error.message); return; }
        setSettings(s.data as Settings);
        setInvoices(((i.data ?? []) as OpsInvoice[]).map((x) => ({ ...x, total: Number(x.total), base: Number(x.base), vat: Number(x.vat), vat_rate: Number(x.vat_rate) })));
        setExpenses(((e.data ?? []) as OpsExpense[]).map((x) => ({ ...x, total: Number(x.total), vat: Number(x.vat) })));
    }, []);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    const yInv = useMemo(() => invoices.filter((i) => i.issue_date.startsWith(String(year))), [invoices, year]);
    const yExp = useMemo(() => expenses.filter((e) => e.spent_on.startsWith(String(year))), [expenses, year]);
    const months = useMemo(() => monthly(yInv, yExp), [yInv, yExp]);
    const sum = (k: 'incomeBase' | 'expensesBase' | 'profit' | 'vatDue' | 'income') => round2(months.reduce((s, m) => s + m[k], 0));
    const thisMonth = months.find((m) => m.month === today().slice(0, 7));
    const log = async (action: string, target = '', detail = '') => { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('ops_log').insert({ staff_id: user?.id, action, target, detail }); };

    async function run(key: string, fn: () => Promise<string | void>) {
        setBusy(key); setErr(''); setMsg('');
        try { const m = await fn(); if (m) setMsg(m); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(''); }
    }
    const saveSettings = () => run('settings', async () => {
        if (!settings) return;
        const { error } = await supabase.from('ops_settings').update({ ...settings, prefix: settings.prefix.toUpperCase(), updated_at: new Date().toISOString() }).eq('id', 1);
        if (error) throw new Error(error.message);
        await log('nastavení provozovatele');
        return 'Údaje provozovatele uložené. Platí pro faktury vystavené od teď.';
    });
    const addExpense = () => run('exp', async () => {
        const total = Number(exp.total.replace(/\s/g, '').replace(',', '.')); const vat = exp.vat.trim() ? Number(exp.vat.replace(/\s/g, '').replace(',', '.')) : 0;
        if (!exp.description.trim() || !(total > 0) || vat < 0 || vat >= total) throw new Error('Vyplňte popis, kladnou částku a DPH menší než částka.');
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('ops_expenses').insert({ spent_on: exp.spent_on, supplier: exp.supplier.trim(), description: exp.description.trim(), category: exp.category, total, vat, doc_no: exp.doc_no.trim(), created_by: user?.id });
        if (error) throw new Error(error.message);
        await log('výdaj', exp.doc_no, `${exp.description} ${total} Kč`);
        setExp({ ...exp, supplier: '', description: '', total: '', vat: '', doc_no: '' });
        return 'Výdaj zapsán.';
    });
    async function removeExpense(e: OpsExpense) {
        if (!(await confirmAction(`Smazat výdaj „${e.description}“ (${kc(e.total)}) z ${dmy(e.spent_on)}?`))) return;
        await run(`del-${e.id}`, async () => { const { error } = await supabase.from('ops_expenses').delete().eq('id', e.id); if (error) throw new Error(error.message); await log('smazání výdaje', e.doc_no, `${e.description} ${e.total} Kč`); return 'Výdaj smazán.'; });
    }
    const issueManual = () => run('manual', async () => {
        if (!manual) return;
        const total = Number(manual.total.replace(/\s/g, '').replace(',', '.'));
        const { error } = await supabase.rpc('ops_manual_invoice', { p_desc: manual.description.trim(), p_total: total, p_paid: manual.paid || null, p_buyer: { name: manual.name.trim(), ico: manual.ico.trim(), address: manual.address.trim(), email: manual.email.trim() }, p_note: '' });
        if (error) throw new Error(error.message);
        setManual(null); return 'Faktura vystavena.';
    });
    async function issueCredit() {
        if (!credit) return;
        const inv = invoices.find((i) => i.id === credit.id);
        if (!(await confirmAction(`Vystavit dobropis k faktuře ${inv?.number} na ${kc(inv?.total ?? 0)}? Dobropis nejde smazat a vrácení peněz provedete sami v bance.`, { title: 'Vystavit dobropis?', confirmLabel: 'Vystavit dobropis', danger: true }))) return;
        await run('credit', async () => { const { error } = await supabase.rpc('ops_credit_note', { p_invoice: credit.id, p_reason: credit.reason }); if (error) throw new Error(error.message); setCredit(null); return 'Dobropis vystaven.'; });
    }
    async function backfill() {
        if (!(await confirmAction('Vystavit faktury ke všem objednávkám, které byly zaplacené před zapnutím účetnictví a fakturu nemají? Čísla dostanou v pořadí data zaplacení.', { title: 'Doplnit faktury', confirmLabel: 'Doplnit', danger: false }))) return;
        await run('backfill', async () => { const { data, error } = await supabase.rpc('ops_backfill'); if (error) throw new Error(error.message); return `Doplněno faktur: ${data ?? 0}.`; });
    }
    const print = (i: OpsInvoice) => { const w = window.open('', '_blank'); if (!w) { setErr('Prohlížeč zablokoval nové okno.'); return; } w.document.write(invoiceHtml(i)); w.document.close(); w.print(); };

    if (missing) return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Účetnictví se zapne po spuštění migrace s účetnictvím provozovatele v Supabase.</p>;
    if (!settings) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    const incomplete = !settings.name || !settings.ico || !settings.address;
    const years = [...new Set([Number(today().slice(0, 4)), ...invoices.map((i) => Number(i.issue_date.slice(0, 4))), ...expenses.map((e) => Number(e.spent_on.slice(0, 4)))])].sort((a, b) => b - a);
    const tile = (label: string, value: string, tone = 'text-slate-900', note = '') => <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>{note && <p className="text-xs text-slate-500">{note}</p>}</div>;

    return (
        <div className="space-y-5">
            {incomplete && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Doplňte údaje provozovatele (název, IČO, adresa) v záložce Nastavení, jinak budou na fakturách chybět.</p>}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
                    {([['prehled', 'Přehled'], ['faktury', `Faktury (${yInv.length})`], ['vydaje', `Výdaje (${yExp.length})`], ['nastaveni', 'Nastavení']] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer ${tab === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{l}</button>)}
                </div>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Rok" className={`${inputCls} w-auto`}>{years.map((y) => <option key={y}>{y}</option>)}</select>
                <button type="button" onClick={() => void load()} className={`${ghost} ml-auto`}><RefreshCw size={14} /> Obnovit</button>
            </div>
            {msg && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</p>}
            {err && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{err}</p>}

            {tab === 'prehled' && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        {tile('Příjmy tento měsíc', kc(thisMonth?.income ?? 0), 'text-slate-900', `${thisMonth?.invoices ?? 0} faktur`)}
                        {tile(`Příjmy ${year} (bez DPH)`, kc(sum('incomeBase')))}
                        {tile(`Výdaje ${year} (bez DPH)`, kc(round2(yExp.reduce((s, e) => s + e.total - e.vat, 0))))}
                        {tile(`Zisk ${year}`, kc(sum('profit')), sum('profit') < 0 ? 'text-rose-700' : 'text-emerald-800', 'příjmy minus výdaje bez DPH')}
                        {tile(settings.vat_payer ? `DPH k odvodu ${year}` : 'DPH', settings.vat_payer ? kc(sum('vatDue')) : 'neplátce')}
                    </div>
                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">Po měsících</h3>
                            <span className="ml-auto flex flex-wrap gap-2">
                                <button type="button" onClick={() => download(`faktury-${year}.csv`, invoicesCsv(yInv))} disabled={!yInv.length} className={ghost}><Download size={14} /> Kniha faktur</button>
                                <button type="button" onClick={() => download(`vydaje-${year}.csv`, expensesCsv(yExp))} disabled={!yExp.length} className={ghost}><Download size={14} /> Výdaje</button>
                                <button type="button" onClick={() => download(`penezni-denik-${year}.csv`, cashBookCsv(cashBook(yInv, yExp)))} className={ghost}><Download size={14} /> Peněžní deník</button>
                            </span></div>
                        {months.length === 0 ? <p className="mt-2 text-sm text-slate-500">V roce {year} zatím žádné doklady.</p> : (
                            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
                                <thead className="text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="py-1 text-left">Měsíc</th><th className="text-right">Faktur</th><th className="text-right">Příjmy bez DPH</th><th className="text-right">Výdaje bez DPH</th><th className="text-right">Zisk</th>{settings.vat_payer && <th className="text-right">DPH k odvodu</th>}</tr></thead>
                                <tbody className="divide-y divide-slate-100">{months.map((m) => <tr key={m.month}><td className="py-1.5 capitalize">{monthName(m.month)}</td><td className="text-right">{m.invoices}</td><td className="text-right">{kc(m.incomeBase)}</td><td className="text-right">{kc(m.expensesBase)}</td><td className={`text-right font-semibold ${m.profit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{kc(m.profit)}</td>{settings.vat_payer && <td className="text-right">{kc(m.vatDue)}</td>}</tr>)}</tbody>
                            </table></div>
                        )}
                        <p className="mt-3 text-xs text-slate-500">Faktury vznikají automaticky v okamžiku, kdy se objednávka označí jako zaplacená (platební bránou nebo ručně). Přehled je pomůcka pro účetní, daňové přiznání a přiznání k DPH připravuje účetní.</p>
                    </section>
                </>
            )}

            {tab === 'faktury' && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setManual({ name: '', ico: '', address: '', email: '', description: '', total: '', paid: today() })} className={primary}><FilePlus2 size={14} /> Ruční faktura</button>
                        <button type="button" onClick={() => void backfill()} disabled={busy === 'backfill'} className={ghost}>{busy === 'backfill' ? <Loader2 size={14} className="animate-spin" /> : <ReceiptText size={14} />} Doplnit faktury k dřívějším platbám</button>
                    </div>
                    {manual && (
                        <form onSubmit={(e) => { e.preventDefault(); void issueManual(); }} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
                            <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Odběratel" aria-label="Odběratel" required className={`${inputCls} sm:col-span-2`} />
                            <input value={manual.ico} onChange={(e) => setManual({ ...manual, ico: e.target.value })} placeholder="IČO" aria-label="IČO" className={inputCls} />
                            <input value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} placeholder="E-mail" aria-label="E-mail" className={inputCls} />
                            <input value={manual.address} onChange={(e) => setManual({ ...manual, address: e.target.value })} placeholder="Adresa" aria-label="Adresa" className={`${inputCls} sm:col-span-4`} />
                            <input value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} placeholder="Za co (popis)" aria-label="Popis" required className={`${inputCls} sm:col-span-2`} />
                            <input value={manual.total} onChange={(e) => setManual({ ...manual, total: e.target.value })} inputMode="decimal" placeholder="Celkem Kč" aria-label="Celkem" required className={inputCls} />
                            <label className="text-xs text-slate-600">Uhrazeno<input type="date" value={manual.paid} onChange={(e) => setManual({ ...manual, paid: e.target.value })} className={`${inputCls} mt-0.5`} /></label>
                            <div className="flex gap-2 sm:col-span-4"><button type="submit" disabled={busy === 'manual'} className={primary}>Vystavit</button><button type="button" onClick={() => setManual(null)} className={ghost}>Zrušit</button></div>
                        </form>
                    )}
                    {yInv.length === 0 ? <p className="mt-3 text-sm text-slate-500">V roce {year} žádné faktury.</p> : (
                        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="py-1 text-left">Číslo</th><th className="text-left">Datum</th><th className="text-left">Odběratel</th><th className="text-left">Popis</th><th className="text-right">Celkem</th><th /></tr></thead>
                            <tbody className="divide-y divide-slate-100">{yInv.map((i) => (
                                <tr key={i.id} className="align-top"><td className="py-1.5 font-mono font-semibold">{i.number}<span className="block font-sans text-[11px] font-normal text-slate-500">{SOURCE_LABEL[i.source] ?? i.source}</span></td><td>{dmy(i.issue_date)}</td><td>{i.buyer.name}{i.buyer.ico ? <span className="block text-xs text-slate-500">IČO {i.buyer.ico}</span> : null}</td><td className="text-slate-700">{i.description}{i.note && <span className="block text-xs text-slate-500">{i.note}</span>}</td><td className={`text-right font-semibold ${i.total < 0 ? 'text-rose-700' : ''}`}>{kc(i.total)}</td>
                                    <td className="whitespace-nowrap pl-2 text-right"><button type="button" onClick={() => print(i)} aria-label={`Tisk ${i.number}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"><Printer size={15} /></button>
                                        {i.total > 0 && !invoices.some((x) => x.credit_for === i.id) && <button type="button" onClick={() => setCredit({ id: i.id, reason: '' })} aria-label={`Dobropis k ${i.number}`} title="Dobropis" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Undo2 size={15} /></button>}</td></tr>
                            ))}</tbody>
                        </table></div>
                    )}
                    {credit && (
                        <form onSubmit={(e) => { e.preventDefault(); void issueCredit(); }} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-3">
                            <span className="text-sm font-semibold text-rose-900">Dobropis k {invoices.find((i) => i.id === credit.id)?.number}</span>
                            <input value={credit.reason} onChange={(e) => setCredit({ ...credit, reason: e.target.value })} placeholder="Důvod (např. vrácení předplatného)" aria-label="Důvod dobropisu" required minLength={3} className={`${inputCls} max-w-md flex-1`} />
                            <button type="submit" disabled={busy === 'credit'} className={primary}>Vystavit dobropis</button><button type="button" onClick={() => setCredit(null)} className={ghost}>Zrušit</button>
                        </form>
                    )}
                </section>
            )}

            {tab === 'vydaje' && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <form onSubmit={(e) => { e.preventDefault(); void addExpense(); }} className="grid gap-2 sm:grid-cols-6">
                        <input type="date" value={exp.spent_on} max={today()} onChange={(e) => setExp({ ...exp, spent_on: e.target.value })} aria-label="Datum" className={inputCls} />
                        <input value={exp.doc_no} onChange={(e) => setExp({ ...exp, doc_no: e.target.value })} placeholder="Číslo dokladu" aria-label="Číslo dokladu" className={inputCls} />
                        <input value={exp.supplier} onChange={(e) => setExp({ ...exp, supplier: e.target.value })} placeholder="Dodavatel" aria-label="Dodavatel" className={`${inputCls} sm:col-span-2`} />
                        <select value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} aria-label="Kategorie" className={`${inputCls} sm:col-span-2`}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                        <input value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} placeholder="Za co" aria-label="Popis výdaje" required className={`${inputCls} sm:col-span-3`} />
                        <input value={exp.total} onChange={(e) => setExp({ ...exp, total: e.target.value })} inputMode="decimal" placeholder="Celkem Kč" aria-label="Celkem" required className={inputCls} />
                        <input value={exp.vat} onChange={(e) => setExp({ ...exp, vat: e.target.value })} inputMode="decimal" placeholder="Z toho DPH" aria-label="Z toho DPH" className={inputCls} />
                        <button type="submit" disabled={busy === 'exp'} className={primary}>Zapsat</button>
                    </form>
                    {yExp.length === 0 ? <p className="mt-3 text-sm text-slate-500">V roce {year} žádné výdaje.</p> : (
                        <ul className="mt-3 divide-y divide-slate-100 text-sm">{yExp.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-3 py-2"><span className="w-24 text-slate-500">{dmy(e.spent_on)}</span><span className="min-w-0 flex-1"><span className="font-semibold text-slate-900">{e.description}</span> <span className="text-slate-500">· {e.supplier || 'bez dodavatele'} · {CATEGORY_LABEL[e.category]}{e.doc_no ? ` · ${e.doc_no}` : ''}</span></span><span className="font-semibold">{kc(e.total)}{e.vat ? <span className="block text-right text-xs font-normal text-slate-500">DPH {kc(e.vat)}</span> : null}</span><button type="button" onClick={() => void removeExpense(e)} aria-label={`Smazat výdaj ${e.description}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button></li>)}</ul>
                    )}
                </section>
            )}

            {tab === 'nastaveni' && (
                <form onSubmit={(e) => { e.preventDefault(); void saveSettings(); }} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
                    <p className="text-sm text-slate-600 sm:col-span-4">Údaje provozovatele na fakturách zákazníkům. Změna platí pro nově vystavené faktury, již vystavené zůstanou beze změny.</p>
                    {([['name', 'Název / jméno', 2], ['ico', 'IČO', 1], ['dic', 'DIČ', 1], ['address', 'Adresa', 4], ['bank_account', 'Číslo účtu', 2], ['email', 'E-mail', 2], ['register_note', 'Zápis v rejstříku (např. Fyzická osoba zapsaná v živnostenském rejstříku)', 4]] as const).map(([k, l, span]) => (
                        <label key={k} className={`text-xs font-semibold text-slate-600 ${span === 4 ? 'sm:col-span-4' : span === 2 ? 'sm:col-span-2' : ''}`}>{l}<input value={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} /></label>
                    ))}
                    <label className="flex items-center gap-2 text-sm text-slate-800 sm:col-span-2"><input type="checkbox" checked={settings.vat_payer} onChange={(e) => setSettings({ ...settings, vat_payer: e.target.checked })} /> Jsem plátce DPH</label>
                    <label className="text-xs font-semibold text-slate-600">Sazba DPH<select value={settings.vat_rate} disabled={!settings.vat_payer} onChange={(e) => setSettings({ ...settings, vat_rate: Number(e.target.value) })} className={`${inputCls} mt-0.5 font-normal`}><option value={21}>21 %</option><option value={12}>12 %</option><option value={0}>0 %</option></select></label>
                    <label className="text-xs font-semibold text-slate-600">Předpona čísla (A–Z, nepovinné)<input value={settings.prefix} maxLength={4} onChange={(e) => setSettings({ ...settings, prefix: e.target.value.replace(/[^a-z]/gi, '').toUpperCase() })} className={`${inputCls} mt-0.5 font-normal`} /></label>
                    <p className="text-xs text-slate-500 sm:col-span-4">Faktury se číslují {settings.prefix}{today().slice(0, 4)}0001, {settings.prefix}{today().slice(0, 4)}0002… (nová řada každý rok). Částka objednávky je konečná cena; u plátce DPH se daň počítá z ní.</p>
                    <div className="sm:col-span-4"><button type="submit" disabled={busy === 'settings'} className={primary}>Uložit údaje</button></div>
                </form>
            )}
        </div>
    );
}

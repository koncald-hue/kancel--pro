'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Clock3, Copy, Plus, Printer, Save, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import type { LawyerClient, TimeEntry } from '@/lib/lawyer';
import { STATUS_LABELS, VAT_RATES, round2, todayIso, type Payment, buildInvoiceHtml, computeTotals, lineBase, lineFromPriceItem, lineFromTimeEntry, loadPriceItems, money, openPrint, parseAmount, qtyText, type DraftLine, type Invoice, type InvoiceLine, type Party, type PriceItem } from '@/lib/billing';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import AresPicker from './AresPicker';
import { useLawyer } from './LawyerGate';

type Line = DraftLine & { key: string; price_item_id: string | null; time_entry_id: string | null; qtyText: string; priceText: string };
const mkLine = (l: DraftLine, extra: Partial<Pick<Line, 'price_item_id' | 'time_entry_id'>> = {}): Line => ({ ...l, key: crypto.randomUUID(), price_item_id: extra.price_item_id ?? null, time_entry_id: extra.time_entry_id ?? null, qtyText: String(l.qty).replace('.', ','), priceText: String(l.unit_price).replace('.', ',') });
const dateCz = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');

// Editor vyúčtování: položky z ceníku a z výkazů práce, výpočet DPH a součtů, vystavení a tisk
export default function LawyerInvoiceEditor() {
    const { userId, access } = useLawyer();
    const router = useRouter();
    const id = usePathname().split('/').filter(Boolean).pop() ?? '';
    const [inv, setInv] = useState<Invoice | null>(null);
    const [lines, setLines] = useState<Line[]>([]);
    const [prices, setPrices] = useState<PriceItem[]>([]);
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [payForm, setPayForm] = useState({ amount: '', date: todayIso(), note: '' });
    const [picker, setPicker] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [priceId, setPriceId] = useState('');
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [i, l, c, e, cs, p, pay] = await Promise.all([
                    supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
                    supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('position'),
                    supabase.from('lawyer_clients').select('*').order('name'),
                    supabase.from('time_entries').select('*').order('entry_date', { ascending: false }),
                    loadCases(),
                    loadPriceItems(),
                    supabase.from('invoice_payments').select('*').eq('invoice_id', id).order('paid_on'),
                ]);
                if (cancelled) return;
                if (i.error) throw new Error(i.error.message);
                if (!i.data) { setMissing(true); return; }
                setInv(i.data as Invoice);
                setLines(((l.data ?? []) as InvoiceLine[]).map((x) => mkLine({ description: x.description, qty: Number(x.qty), unit: x.unit, unit_price: Number(x.unit_price), vat_rate: Number(x.vat_rate) }, { price_item_id: x.price_item_id, time_entry_id: x.time_entry_id })));
                setClients((c.data ?? []) as LawyerClient[]); setEntries((e.data ?? []) as TimeEntry[]); setCases(cs); setPrices(p.filter((x) => x.active));
                if (!pay.error) setPayments(((pay.data ?? []) as Payment[]).map((x) => ({ ...x, amount: Number(x.amount) })));
            } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Nepodařilo se načíst.'); }
        })();
        return () => { cancelled = true; };
    }, [id]);

    const draft = inv?.status === 'draft';
    const vatPayer = draft ? !!access.vat_payer : inv?.supplier_snapshot.vat_payer === true;
    const parsed = useMemo(() => lines.map((l) => ({ ...l, qty: parseAmount(l.qtyText) ?? 0, unit_price: parseAmount(l.priceText) ?? 0 })), [lines]);
    const totals = computeTotals(parsed, vatPayer);
    const patch = (p: Partial<Invoice>) => setInv((x) => (x ? { ...x, ...p } : x));
    const setLine = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
    const defaultVat = vatPayer ? 21 : 0;

    const client = clients.find((c) => c.id === inv?.client_id) ?? null;
    const buyer: Party = client ? { name: client.name, address: client.address, ico: client.ico, dic: client.dic, email: client.email, phone: client.phone } : (inv?.client_snapshot ?? {});
    const clientCases = cases.filter((c) => !inv?.client_id || c.client_id === inv.client_id);
    const unbilled = entries.filter((e) => !e.billed && !lines.some((l) => l.time_entry_id === e.id) && (!inv?.case_id || e.case_id === inv.case_id) && (!inv?.client_id || cases.find((c) => c.id === e.case_id)?.client_id === inv.client_id));

    async function save(): Promise<boolean> {
        if (!inv || !draft) return false;
        const bad = parsed.find((l) => !l.description.trim() || l.qty === 0);
        if (bad) { setError('Každá položka musí mít popis a nenulové množství.'); return false; }
        setBusy(true); setError(''); setMsg('');
        const head = await supabase.from('invoices').update({ client_id: inv.client_id, case_id: inv.case_id, title: inv.title.slice(0, 200), issue_date: inv.issue_date, due_date: inv.due_date || null, note: inv.note.slice(0, 1000), currency: inv.currency, client_snapshot: inv.client_id ? {} : inv.client_snapshot }).eq('id', inv.id);
        if (head.error) { setBusy(false); setError(head.error.message); return false; }
        const del = await supabase.from('invoice_lines').delete().eq('invoice_id', inv.id);
        if (del.error) { setBusy(false); setError(del.error.message); return false; }
        if (parsed.length) {
            const ins = await supabase.from('invoice_lines').insert(parsed.map((l, position) => ({ invoice_id: inv.id, user_id: userId, position, description: l.description.trim().slice(0, 500), qty: l.qty, unit: l.unit || 'ks', unit_price: l.unit_price, vat_rate: l.vat_rate, price_item_id: l.price_item_id, time_entry_id: l.time_entry_id })));
            if (ins.error) { setBusy(false); setError(ins.error.message); return false; }
        }
        setBusy(false); setMsg('Uloženo.');
        return true;
    }

    async function issue() {
        if (!inv) return;
        if (!window.confirm('Vystavit vyúčtování? Po vystavení už nepůjde upravit a použité výkazy se označí jako vyfakturované.')) return;
        if (!(await save())) return;
        setBusy(true);
        const { data, error: err } = await supabase.rpc('issue_invoice', { p_id: inv.id });
        setBusy(false);
        if (err) { setError(err.message); return; }
        setMsg(`Vystaveno pod číslem ${String(data)}.`);
        const fresh = await supabase.from('invoices').select('*').eq('id', inv.id).single();
        if (fresh.data) setInv(fresh.data as Invoice);
    }

    async function setStatus(status: 'paid' | 'cancelled' | 'issued') {
        if (!inv) return;
        const { error: err } = await supabase.from('invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', inv.id);
        if (err) { setError(err.message); return; }
        patch({ status, paid_at: status === 'paid' ? new Date().toISOString() : null });
    }

    async function remove() {
        if (!inv || !window.confirm('Smazat koncept vyúčtování?')) return;
        const { error: err } = await supabase.from('invoices').delete().eq('id', inv.id);
        if (err) setError(err.message); else router.push('/kancelar/faktury');
    }

    async function duplicate() {
        if (!inv) return;
        const created = await supabase.from('invoices').insert({ user_id: userId, client_id: inv.client_id, case_id: inv.case_id, title: inv.title, note: inv.note, currency: inv.currency, issue_date: new Date().toISOString().slice(0, 10) }).select('id').single();
        if (created.error) { setError(created.error.message); return; }
        const newId = (created.data as { id: string }).id;
        if (parsed.length) await supabase.from('invoice_lines').insert(parsed.map((l, position) => ({ invoice_id: newId, user_id: userId, position, description: l.description, qty: l.qty, unit: l.unit, unit_price: l.unit_price, vat_rate: l.vat_rate, price_item_id: l.price_item_id })));
        router.push(`/kancelar/faktury/${newId}`);
    }

    const paidSum = round2(payments.reduce((s, p) => s + p.amount, 0));
    const remaining = round2(totals.total - paidSum);

    // Po každé změně plateb se stav vyúčtování srovná se zaplacenou částkou
    async function syncStatus(list: Payment[]) {
        if (!inv || inv.status === 'draft' || inv.status === 'cancelled') return;
        const sum = round2(list.reduce((s, p) => s + p.amount, 0));
        const next = sum >= totals.total && totals.total > 0 ? 'paid' : 'issued';
        if (next === inv.status) return;
        const paidAt = next === 'paid' ? new Date().toISOString() : null;
        const { error: err } = await supabase.from('invoices').update({ status: next, paid_at: paidAt }).eq('id', inv.id);
        if (err) setError(err.message); else patch({ status: next, paid_at: paidAt });
    }

    async function addPayment() {
        if (!inv) return;
        const amount = parseAmount(payForm.amount);
        if (amount === null || amount === 0) { setError('Zadejte částku platby, např. 5000 nebo 1 250,50.'); return; }
        setError('');
        const { data, error: err } = await supabase.from('invoice_payments').insert({ invoice_id: inv.id, user_id: userId, amount, paid_on: payForm.date || todayIso(), note: payForm.note.trim().slice(0, 300) }).select('*').single();
        if (err) { setError(/invoice_payments|relation|does not exist/i.test(err.message) ? 'Platby zatím nejsou v databázi zapnuté (chybí spuštění souboru platby.sql).' : err.message); return; }
        const list = [...payments, { ...(data as Payment), amount: Number((data as Payment).amount) }];
        setPayments(list); setPayForm({ amount: '', date: todayIso(), note: '' });
        await syncStatus(list);
    }

    async function markPaidFully() {
        if (!inv) return;
        if (remaining > 0) {
            const { data, error: err } = await supabase.from('invoice_payments').insert({ invoice_id: inv.id, user_id: userId, amount: remaining, paid_on: todayIso(), note: '' }).select('*').single();
            if (!err && data) setPayments((l) => [...l, { ...(data as Payment), amount: Number((data as Payment).amount) }]);
        }
        await setStatus('paid');
    }

    async function removePayment(pid: string) {
        const { error: err } = await supabase.from('invoice_payments').delete().eq('id', pid);
        if (err) { setError(err.message); return; }
        const list = payments.filter((p) => p.id !== pid);
        setPayments(list);
        await syncStatus(list);
    }

    function print() {
        if (!inv) return;
        const view: Invoice = draft ? { ...inv, client_snapshot: buyer, supplier_snapshot: { name: access.display_name || access.email, firm: access.firm_name, address: access.office, ico: access.ico, dic: access.dic, vat_payer: access.vat_payer, bank_account: access.bank_account, email: access.contact_email || access.email, phone: access.phone, note: access.invoice_note } } : inv;
        if (!openPrint(buildInvoiceHtml(view, parsed, totals, vatPayer))) setError('Prohlížeč zablokoval nové okno. Povolte vyskakovací okna.');
    }

    if (missing) return <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">Vyúčtování nenalezeno. <Link href="/kancelar/faktury" className="font-semibold text-indigo-800 underline">Zpět na přehled</Link></p>;
    if (!inv) return error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : <p className="text-sm text-slate-500" role="status">Načítám…</p>;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/kancelar/faktury" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-800 hover:underline"><ArrowLeft size={15} /> Fakturace</Link>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={print} className={ghostBtn}><Printer size={15} /> Tisk / PDF</button>
                    {!draft && <button type="button" onClick={() => void duplicate()} className={ghostBtn}><Copy size={15} /> Kopírovat jako nový</button>}
                    {inv.status === 'issued' && <><button type="button" onClick={() => void markPaidFully()} className={primaryBtn}><Check size={15} /> Označit jako zaplacené</button><button type="button" onClick={() => { if (window.confirm('Stornovat vyúčtování?')) void setStatus('cancelled'); }} className={`${ghostBtn} text-rose-700`}>Storno</button></>}
                    {inv.status === 'paid' && <button type="button" onClick={() => void setStatus('issued')} className={ghostBtn}>Vrátit na nezaplacené</button>}
                    {draft && <><button type="button" onClick={() => void remove()} className={`${ghostBtn} text-rose-700`}><Trash2 size={15} /> Smazat</button><button type="button" onClick={() => void save()} disabled={busy} className={ghostBtn}><Save size={15} /> Uložit</button><button type="button" onClick={() => void issue()} disabled={busy} className={primaryBtn}><Send size={15} /> Vystavit</button></>}
                </div>
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {msg && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</p>}

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900">{inv.number ? `Faktura č. ${inv.number}` : 'Nové vyúčtování'}</h1>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{STATUS_LABELS[inv.status]}</span>
                    {!vatPayer && <span className="text-xs text-slate-500">Neplátce DPH</span>}
                </div>
                <fieldset disabled={!draft} className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Odběratel (klient)
                        <select value={inv.client_id ?? ''} onChange={(e) => patch({ client_id: e.target.value || null, case_id: null })} className={`${inputCls} mt-1 font-normal`}>
                            <option value="">— jiný odběratel (vyplním ručně) —</option>
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">Věc (nepovinné)
                        <select value={inv.case_id ?? ''} onChange={(e) => patch({ case_id: e.target.value || null })} className={`${inputCls} mt-1 font-normal`}>
                            <option value="">Bez věci</option>
                            {clientCases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                    </label>
                    {!inv.client_id && draft && <div className="sm:col-span-3"><AresPicker compact onPick={(c) => patch({ client_snapshot: { ...inv.client_snapshot, name: c.name, address: c.address, ico: c.ico, dic: c.dic } })} label="Najít odběratele v ARES" /></div>}
                    {!inv.client_id && draft && (['name', 'address', 'ico', 'dic'] as const).map((k) => (
                        <label key={k} className="block text-xs font-semibold text-slate-600">{{ name: 'Jméno / firma', address: 'Adresa', ico: 'IČO', dic: 'DIČ' }[k]}<input value={inv.client_snapshot[k] ?? ''} onChange={(e) => patch({ client_snapshot: { ...inv.client_snapshot, [k]: e.target.value } })} maxLength={200} className={`${inputCls} mt-1 font-normal`} /></label>
                    ))}
                    {client && <p className="text-xs text-slate-500 sm:col-span-3">{[client.address, client.ico && `IČO ${client.ico}`, client.dic && `DIČ ${client.dic}`].filter(Boolean).join(' · ') || 'Klient nemá vyplněnou adresu a IČO. Doplníte je v záložce Klienti.'}</p>}
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-3">Název / předmět (nepovinné)<input value={inv.title} onChange={(e) => patch({ title: e.target.value })} maxLength={200} className={`${inputCls} mt-1 font-normal`} placeholder="např. Zastupování ve věci Novák proti Dvořákovi" /></label>
                    <label className="block text-xs font-semibold text-slate-600">Datum vystavení<input type="date" value={inv.issue_date} onChange={(e) => patch({ issue_date: e.target.value })} className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className="block text-xs font-semibold text-slate-600">Splatnost<input type="date" value={inv.due_date ?? ''} onChange={(e) => patch({ due_date: e.target.value || null })} className={`${inputCls} mt-1 font-normal`} /><span className="font-normal text-slate-400">prázdné = {access.due_days ?? 14} dní od vystavení</span></label>
                    <label className="block text-xs font-semibold text-slate-600">Měna<select value={inv.currency} onChange={(e) => patch({ currency: e.target.value as 'CZK' | 'EUR' })} className={`${inputCls} mt-1 font-normal`}><option value="CZK">Kč</option><option value="EUR">€</option></select></label>
                </fieldset>
                {!draft && <p className="mt-3 text-xs text-slate-500">Vystaveno {dateCz(inv.issue_date)}, splatnost {dateCz(inv.due_date)}{inv.paid_at ? `, zaplaceno ${new Date(inv.paid_at).toLocaleDateString('cs-CZ')}` : ''}. Vystavené vyúčtování nelze upravovat.</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Položky">
                <h2 className="text-lg font-bold text-slate-900">Položky</h2>
                {draft && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <select value={priceId} onChange={(e) => setPriceId(e.target.value)} className={`${inputCls} max-w-xs`} aria-label="Položka z ceníku">
                            <option value="">Vybrat z ceníku…</option>
                            {prices.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.unit_price)} / {p.unit}</option>)}
                        </select>
                        <button type="button" disabled={!priceId} onClick={() => { const p = prices.find((x) => x.id === priceId); if (p) { setLines((ls) => [...ls, mkLine(lineFromPriceItem(p), { price_item_id: p.id })]); setPriceId(''); } }} className={ghostBtn}><Plus size={15} /> Přidat z ceníku</button>
                        <button type="button" onClick={() => setLines((ls) => [...ls, mkLine({ description: '', qty: 1, unit: 'ks', unit_price: 0, vat_rate: defaultVat })])} className={ghostBtn}><Plus size={15} /> Vlastní položka</button>
                        <button type="button" onClick={() => { setPicker((v) => !v); setSelected([]); }} className={ghostBtn}><Clock3 size={15} /> Z výkazů práce ({unbilled.length})</button>
                    </div>
                )}
                {picker && draft && (
                    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                        {unbilled.length === 0 ? <p className="text-sm text-slate-600">Žádné nevyfakturované výkazy pro vybraného klienta a věc.</p> : (
                            <>
                                <ul className="max-h-60 space-y-1 overflow-auto text-sm">
                                    {unbilled.map((e) => (
                                        <li key={e.id}><label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={selected.includes(e.id)} onChange={() => setSelected((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]))} className="mt-1 h-4 w-4 accent-indigo-700" /><span>{dateCz(e.entry_date)} · {e.description || 'Právní služby'} <span className="text-slate-500">· {(e.minutes / 60).toFixed(2)} h × {money(e.rate)}</span></span></label></li>
                                    ))}
                                </ul>
                                <button type="button" disabled={!selected.length} onClick={() => { setLines((ls) => [...ls, ...unbilled.filter((e) => selected.includes(e.id)).map((e) => mkLine(lineFromTimeEntry(e, defaultVat), { time_entry_id: e.id }))]); setPicker(false); setSelected([]); }} className={`${primaryBtn} mt-3`}>Přidat vybrané ({selected.length})</button>
                            </>
                        )}
                    </div>
                )}
                {lines.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Zatím žádné položky.</p> : (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-2">Popis</th><th className="px-2 py-2 w-24">Množství</th><th className="px-2 py-2 w-20">Jedn.</th><th className="px-2 py-2 w-28">Cena</th>{vatPayer && <th className="px-2 py-2 w-20">DPH</th>}<th className="px-2 py-2 w-28 text-right">Celkem</th><th className="w-8" /></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {lines.map((l, i) => (
                                    <tr key={l.key}>
                                        <td className="py-1.5 pr-2"><input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} disabled={!draft} maxLength={500} aria-label={`Popis položky ${i + 1}`} className={inputCls} /></td>
                                        <td className="px-2 py-1.5"><input value={l.qtyText} onChange={(e) => setLine(l.key, { qtyText: e.target.value })} disabled={!draft} inputMode="decimal" aria-label={`Množství ${i + 1}`} className={inputCls} /></td>
                                        <td className="px-2 py-1.5"><input value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} disabled={!draft} maxLength={20} aria-label={`Jednotka ${i + 1}`} className={inputCls} /></td>
                                        <td className="px-2 py-1.5"><input value={l.priceText} onChange={(e) => setLine(l.key, { priceText: e.target.value })} disabled={!draft} inputMode="decimal" aria-label={`Cena ${i + 1}`} className={inputCls} /></td>
                                        {vatPayer && <td className="px-2 py-1.5"><select value={l.vat_rate} onChange={(e) => setLine(l.key, { vat_rate: Number(e.target.value) })} disabled={!draft} aria-label={`DPH ${i + 1}`} className={inputCls}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</select></td>}
                                        <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{money(lineBase({ qty: parsed[i].qty, unit_price: parsed[i].unit_price }), inv.currency)}</td>
                                        <td className="py-1.5">{draft && <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Odebrat položku ${i + 1}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
                    {vatPayer && totals.groups.map((g) => <p key={g.rate} className="flex justify-between text-slate-600"><span>Základ {g.rate} % / DPH</span><span>{money(g.base, inv.currency)} / {money(g.vat, inv.currency)}</span></p>)}
                    <p className="flex justify-between text-slate-600"><span>Základ celkem</span><span>{money(totals.base, inv.currency)}</span></p>
                    {vatPayer && <p className="flex justify-between text-slate-600"><span>DPH celkem</span><span>{money(totals.vat, inv.currency)}</span></p>}
                    <p className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-900"><span>K úhradě</span><span>{money(totals.total, inv.currency)}</span></p>
                    <p className="text-right text-xs text-slate-400">{lines.length} {lines.length === 1 ? 'položka' : 'položek'} · {qtyText(parsed.reduce((s, l) => s + (l.unit === 'hod' ? l.qty : 0), 0))} h</p>
                </div>
                <label className="mt-4 block text-xs font-semibold text-slate-600">Poznámka na dokladu (nepovinné)<input value={inv.note} onChange={(e) => patch({ note: e.target.value })} disabled={!draft} maxLength={1000} className={`${inputCls} mt-1 font-normal`} /></label>
            </section>

            {!draft && inv.status !== 'cancelled' && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Platby">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-lg font-bold text-slate-900">Platby</h2>
                        <p className="text-sm text-slate-600">Zaplaceno <strong className="text-slate-900">{money(paidSum, inv.currency)}</strong> z {money(totals.total, inv.currency)} · zbývá <strong className={remaining > 0 ? 'text-slate-900' : 'text-emerald-700'}>{money(Math.max(0, remaining), inv.currency)}</strong></p>
                    </div>
                    {payments.length > 0 && (
                        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                            {payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2"><span><strong className="text-slate-900">{money(p.amount, inv.currency)}</strong> · {dateCz(p.paid_on)}{p.note && <span className="text-slate-500"> · {p.note}</span>}</span><button type="button" onClick={() => void removePayment(p.id)} aria-label="Smazat platbu" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button></li>)}
                        </ul>
                    )}
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
                        <label className="block text-xs font-semibold text-slate-600">Částka<input value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} inputMode="decimal" className={`${inputCls} mt-1 font-normal`} placeholder={remaining > 0 ? String(remaining).replace('.', ',') : '0'} /></label>
                        <label className="block text-xs font-semibold text-slate-600">Datum<input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} className={`${inputCls} mt-1 font-normal`} /></label>
                        <label className="block text-xs font-semibold text-slate-600">Poznámka<input value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} maxLength={300} className={`${inputCls} mt-1 font-normal`} placeholder="např. záloha, převod z účtu" /></label>
                        <button type="button" onClick={() => void addPayment()} className={primaryBtn}><Plus size={15} /> Zapsat platbu</button>
                    </div>
                    {remaining > 0 && <button type="button" onClick={() => setPayForm((f) => ({ ...f, amount: String(remaining).replace('.', ',') }))} className="mt-2 text-xs font-semibold text-indigo-800 underline">Doplnit zbývající částku ({money(remaining, inv.currency)})</button>}
                </section>
            )}
        </div>
    );
}

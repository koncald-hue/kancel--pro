'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { money, parseAmount, todayIso } from '@/lib/billing';
import { createDraftInvoice } from '@/lib/invoiceDraft';
import { EVERY_LABEL, dueNow, nextOn, periodLabel, periodOf, type Every } from '@/lib/recurring';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Line = { description: string; qty: number; unit: string; unit_price: number; vat_rate: number };
type Row = { id: string; client_id: string | null; case_id: string | null; title: string; lines: Line[]; every: Every; next_on: string; active: boolean; last_period: string | null };
const dmy = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ');

// Opakovaná fakturace (paušály): z šablony se k termínu připraví koncept vyúčtování; vystavuje ho advokát sám
export default function RecurringInvoices({ onCreated }: { onCreated: () => void | Promise<void> }) {
    const { userId, access } = useLawyer();
    const [rows, setRows] = useState<Row[] | null>(null);
    const [missing, setMissing] = useState(false);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [form, setForm] = useState<{ client_id: string; title: string; every: Every; next_on: string; description: string; price: string; vat: string } | null>(null);
    const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
    const today = todayIso();

    const load = useCallback(async () => {
        const [r, c] = await Promise.all([supabase.from('invoice_recurring').select('*').order('next_on'), supabase.from('lawyer_clients').select('id, name').order('name')]);
        if (r.error) { if (/invoice_recurring|schema cache|does not exist/i.test(r.error.message)) setMissing(true); setRows([]); return; }
        setRows((r.data ?? []) as Row[]); setClients((c.data ?? []) as { id: string; name: string }[]);
    }, []);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    if (missing || rows === null) return null;
    const due = dueNow(rows, today);
    const vatDefault = access.vat_payer ? '21' : '0';

    async function save() {
        if (!form) return;
        const price = parseAmount(form.price);
        if (!form.title.trim() || !form.description.trim() || price === null || price <= 0) { setErr('Vyplňte název, popis položky a kladnou cenu.'); return; }
        setBusy(true); setErr('');
        const { error } = await supabase.from('invoice_recurring').insert({ user_id: userId, client_id: form.client_id || null, title: form.title.trim().slice(0, 200), every: form.every, next_on: form.next_on, lines: [{ description: form.description.trim().slice(0, 500), qty: 1, unit: form.every === 'month' ? 'měsíc' : form.every === 'quarter' ? 'čtvrtletí' : 'rok', unit_price: price, vat_rate: Number(form.vat) }] });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        setForm(null); await load();
    }
    // Každá šablona se nejdřív „zabere“ (posun termínu jen tehdy, když ho mezitím nikdo neposunul), teprve pak vznikne koncept
    async function createDue() {
        setBusy(true); setErr(''); setMsg('');
        let made = 0;
        for (const r of due) {
            const period = periodOf(r.next_on, r.every);
            const claim = await supabase.from('invoice_recurring').update({ last_period: period, next_on: nextOn(r.next_on, r.every) }).eq('id', r.id).eq('next_on', r.next_on).select('id');
            if (claim.error || !(claim.data ?? []).length) continue;
            try {
                await createDraftInvoice({ userId, title: `${r.title} – ${periodLabel(period)}`, clientId: r.client_id, caseId: r.case_id, lines: r.lines.map((l) => ({ ...l, description: `${l.description} (${periodLabel(period)})` })) });
                made++;
            } catch (e) {
                // Koncept se nepovedl: vrátit termín, aby šel vytvořit znovu
                await supabase.from('invoice_recurring').update({ last_period: r.last_period, next_on: r.next_on }).eq('id', r.id);
                setErr(e instanceof Error ? e.message : 'Koncept se nepodařilo vytvořit.');
            }
        }
        setBusy(false); setMsg(made ? `Připraveno konceptů: ${made}. Najdete je níže mezi koncepty, zkontrolujte je a vystavte.` : 'Nic nového k vytvoření.');
        await load(); await onCreated();
    }
    const toggle = async (r: Row) => { await supabase.from('invoice_recurring').update({ active: !r.active }).eq('id', r.id); await load(); };
    const remove = async (r: Row) => { if (await confirmAction(`Smazat opakovanou fakturaci „${r.title}“? Už vystavené faktury zůstanou.`)) { await supabase.from('invoice_recurring').delete().eq('id', r.id); await load(); } };
    const total = (r: Row) => r.lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Opakovaná fakturace">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-2 font-bold text-slate-900"><Repeat size={16} className="text-indigo-700" aria-hidden="true" /> Opakovaná fakturace ({rows.length})</h2>
                {due.length > 0 && <button type="button" onClick={() => void createDue()} disabled={busy} className={`${primaryBtn} ml-auto`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />} Připravit koncepty na řadě ({due.length})</button>}
                <button type="button" onClick={() => setForm({ client_id: '', title: 'Paušální odměna', every: 'month', next_on: today, description: 'Paušální odměna za právní služby', price: '', vat: vatDefault })} className={`${ghostBtn} ${due.length ? '' : 'ml-auto'}`}><Plus size={14} /> Nová</button>
            </div>
            {msg && <p role="status" className="mt-2 text-sm text-emerald-800">{msg}</p>}
            {err && <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">{err}</p>}
            {form && (
                <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-6">
                    <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} aria-label="Klient" className={`${inputCls} sm:col-span-2`}><option value="">Klient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} aria-label="Název" placeholder="Název" className={`${inputCls} sm:col-span-2`} />
                    <select value={form.every} onChange={(e) => setForm({ ...form, every: e.target.value as Every })} aria-label="Jak často" className={inputCls}>{(Object.keys(EVERY_LABEL) as Every[]).map((k) => <option key={k} value={k}>{EVERY_LABEL[k]}</option>)}</select>
                    <label className="text-xs text-slate-600">První koncept<input type="date" value={form.next_on} onChange={(e) => setForm({ ...form, next_on: e.target.value })} className={`${inputCls} mt-0.5`} /></label>
                    <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} aria-label="Popis položky" placeholder="Popis položky" className={`${inputCls} sm:col-span-3`} />
                    <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} inputMode="decimal" aria-label="Cena bez DPH" placeholder="Cena bez DPH" className={inputCls} />
                    <select value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} aria-label="DPH" className={inputCls} disabled={!access.vat_payer}>{['21', '12', '0'].map((v) => <option key={v} value={v}>{v} %</option>)}</select>
                    <button type="submit" disabled={busy} className={primaryBtn}>Uložit</button>
                </form>
            )}
            {rows.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {rows.map((r) => (
                        <li key={r.id} className={`flex flex-wrap items-center gap-3 py-2 ${r.active ? '' : 'opacity-60'}`}>
                            <span className="min-w-0 flex-1"><span className="font-semibold text-slate-900">{r.title}</span> <span className="text-slate-500">· {clients.find((c) => c.id === r.client_id)?.name ?? 'bez klienta'} · {EVERY_LABEL[r.every]} · {money(total(r))} bez DPH</span>
                                <span className="block text-xs text-slate-500">{r.active ? `Další koncept ${dmy(r.next_on)} (${periodLabel(periodOf(r.next_on, r.every))})` : 'Pozastaveno'}{r.last_period ? ` · naposledy ${periodLabel(r.last_period)}` : ''}</span></span>
                            <button type="button" onClick={() => void toggle(r)} aria-label={r.active ? 'Pozastavit' : 'Obnovit'} title={r.active ? 'Pozastavit' : 'Obnovit'} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer">{r.active ? <Pause size={15} /> : <Play size={15} />}</button>
                            <button type="button" onClick={() => void remove(r)} aria-label="Smazat" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
                        </li>
                    ))}
                </ul>
            )}
            {rows.length === 0 && !form && <p className="mt-2 text-sm text-slate-500">Paušály a pravidelné odměny: Kancelář k termínu připraví koncept vyúčtování, vy ho jen zkontrolujete a vystavíte.</p>}
        </section>
    );
}

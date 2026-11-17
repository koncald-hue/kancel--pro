'use client';

import WorkSuggestions from './WorkSuggestions';
import { useEffect, useState } from 'react';
import { Download, Pause, Play, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { downloadTextFile } from '@/lib/caseFile';
import { czk, entryAmount, formatMinutes, parseDuration, timesheetCsv, type LawyerClient, type TimeEntry } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { loadPriceItems, money, type PriceItem } from '@/lib/billing';
import { useLawyer } from './LawyerGate';

const TIMER_KEY = 'lawyerTimer';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function LawyerTimesheet() {
    const { userId, access } = useLawyer();
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [error, setError] = useState('');
    const [services, setServices] = useState<PriceItem[]>([]);
    const [filter, setFilter] = useState<'open' | 'all'>('open');
    const [form, setForm] = useState({ caseId: '', date: today(), duration: '', description: '', rate: '' });
    // Stopky se obnoví z úložiště prohlížeče (přežijí obnovení stránky)
    const [timer, setTimer] = useState<{ caseId: string; startedAt: number } | null>(() => { try { const saved = JSON.parse(localStorage.getItem(TIMER_KEY) ?? 'null'); return saved?.startedAt ? saved : null; } catch { return null; } });
    const [now, setNow] = useState(0);

    useEffect(() => {
        let cancelled = false;
        Promise.all([supabase.from('time_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }), supabase.from('lawyer_clients').select('*'), loadCases()])
            .then(([e, c, all]) => { if (cancelled) return; if (e.error) throw new Error(e.error.message); setEntries((e.data ?? []) as TimeEntry[]); setClients((c.data ?? []) as LawyerClient[]); setCases(all); })
            .catch(() => { if (!cancelled) setError('Výkazy se nepodařilo načíst. Zkontrolujte, že je spuštěné SQL lawyer.sql.'); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        loadPriceItems().then((list) => { if (!cancelled) setServices(list.filter((p) => p.active && p.unit === 'hod')); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    // Běžící stopky: sekundový tik jen když běží
    useEffect(() => {
        if (!timer) return;
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [timer]);

    const rateFor = (caseId: string) => {
        const c = cases.find((x) => x.id === caseId);
        const client = clients.find((x) => x.name.toLowerCase() === (c?.client_name ?? '').trim().toLowerCase());
        return client?.hourly_rate ?? access.default_rate ?? 0;
    };
    const caseTitle = (id: string | null) => cases.find((c) => c.id === id)?.title ?? 'Bez věci';

    const startTimer = () => { const t = { caseId: form.caseId, startedAt: Date.now() }; setTimer(t); setNow(Date.now()); try { localStorage.setItem(TIMER_KEY, JSON.stringify(t)); } catch { /* ok */ } };
    const stopTimer = () => {
        if (!timer) return;
        const minutes = Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000));
        setForm((f) => ({ ...f, caseId: timer.caseId, duration: String(minutes), rate: String(rateFor(timer.caseId) || '') }));
        setTimer(null);
        try { localStorage.removeItem(TIMER_KEY); } catch { /* ok */ }
    };

    async function add() {
        const minutes = parseDuration(form.duration);
        if (!minutes) { setError('Zadejte délku, např. 1:30, 1,5h nebo 45.'); return; }
        const rate = form.rate.trim() ? Number(form.rate.replace(',', '.')) : rateFor(form.caseId);
        const { data, error: err } = await supabase.from('time_entries').insert({ user_id: userId, case_id: form.caseId || null, entry_date: form.date, minutes, description: form.description.trim().slice(0, 500), rate: Number.isFinite(rate) ? rate : 0 }).select('*').single();
        if (err) { setError(err.message); return; }
        setEntries((list) => [data as TimeEntry, ...list]);
        setForm((f) => ({ ...f, duration: '', description: '', rate: '' })); setError('');
    }

    async function toggleBilled(e: TimeEntry) {
        const { error: err } = await supabase.from('time_entries').update({ billed: !e.billed }).eq('id', e.id);
        if (err) setError(err.message); else setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, billed: !e.billed } : x)));
    }

    async function remove(e: TimeEntry) {
        const { error: err } = await supabase.from('time_entries').delete().eq('id', e.id);
        if (err) setError(err.message); else setEntries((list) => list.filter((x) => x.id !== e.id));
    }

    const shown = entries.filter((e) => filter === 'all' || !e.billed);
    const minutes = shown.reduce((s, e) => s + e.minutes, 0);
    const amount = shown.reduce((s, e) => s + entryAmount(e), 0);
    const elapsed = timer ? Math.max(0, Math.floor(((now || timer.startedAt) - timer.startedAt) / 1000)) : 0;

    function exportCsv() {
        downloadTextFile('vykaz-prace.csv', timesheetCsv(shown.map((entry) => { const c = cases.find((x) => x.id === entry.case_id); return { entry, caseTitle: c?.title ?? '', client: c?.client_name ?? '' }; })), 'text/csv;charset=utf-8');
    }

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}<button type="button" onClick={() => setError('')} className="font-semibold underline cursor-pointer">Zavřít</button></p>}

            <WorkSuggestions userId={userId} cases={cases} rateFor={rateFor} onAdded={(rows) => setEntries((list) => [...rows, ...list])} />

            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-[1.4fr_auto_auto_auto]">
                    {services.length > 0 && <select value="" onChange={(e) => { const p = services.find((x) => x.id === e.target.value); if (p) setForm((f) => ({ ...f, description: f.description || p.name, rate: String(p.unit_price) })); }} className={`${inputCls} sm:col-span-full`} aria-label="Hodinová služba z ceníku"><option value="">Služba z ceníku…</option>{services.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.unit_price)}/h</option>)}</select>}
                    <select value={form.caseId} onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))} className={inputCls} aria-label="Věc">
                        <option value="">Bez věci</option>
                        {cases.filter((c) => c.status === 'open').map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}
                    </select>
                    <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} aria-label="Datum" />
                    <input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="Doba: 1:30" className={`${inputCls} sm:w-28`} aria-label="Doba" />
                    <input value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} placeholder={`Sazba ${rateFor(form.caseId) || ''}`} inputMode="decimal" className={`${inputCls} sm:w-28`} aria-label="Sazba za hodinu" />
                </div>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Co jste dělali (např. Porada s klientem, příprava odporu)" maxLength={500} className={inputCls} aria-label="Popis práce" />
                <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className={primaryBtn}>Zapsat čas</button>
                    {timer ? (
                        <button type="button" onClick={stopTimer} className={`${ghostBtn} border-rose-300 text-rose-800`}><Pause size={15} /> Zastavit stopky · {formatMinutes(Math.floor(elapsed / 60))}:{String(elapsed % 60).padStart(2, '0')}</button>
                    ) : (
                        <button type="button" onClick={startTimer} className={ghostBtn}><Play size={15} /> Spustit stopky</button>
                    )}
                    <span className="text-xs text-slate-500">Po zastavení se doba doplní do formuláře.</span>
                </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2" role="group" aria-label="Filtr">
                    {([['open', 'Nevyfakturované'], ['all', 'Vše']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={`rounded-full border px-3.5 py-1 text-xs font-semibold cursor-pointer ${filter === v ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>{l}</button>)}
                </div>
                <div className="flex items-center gap-3 text-sm"><strong>{formatMinutes(minutes)} h</strong><span className="text-slate-500">·</span><strong>{czk(amount)}</strong>
                    <button type="button" onClick={exportCsv} disabled={!shown.length} className={ghostBtn}><Download size={15} /> CSV</button></div>
            </div>

            {shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Zatím žádné záznamy. Zapište první čas výše.</p> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Datum</th><th className="px-3 py-2.5">Věc a popis</th><th className="px-3 py-2.5">Čas</th><th className="px-3 py-2.5">Částka</th><th className="px-3 py-2.5">Faktura</th><th className="px-2 py-2.5"><span className="sr-only">Akce</span></th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map((e) => (
                                <tr key={e.id}>
                                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('cs-CZ')}</td>
                                    <td className="px-3 py-2.5"><span className="font-semibold text-slate-900">{caseTitle(e.case_id)}</span>{e.description && <span className="block text-xs text-slate-500">{e.description}</span>}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{formatMinutes(e.minutes)}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{czk(entryAmount(e))}</td>
                                    <td className="px-3 py-2.5"><label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={e.billed} onChange={() => void toggleBilled(e)} className="h-4 w-4 accent-indigo-800" /> vyfakturováno</label></td>
                                    <td className="px-2 py-2.5 text-right"><button type="button" onClick={() => void remove(e)} aria-label="Smazat záznam" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

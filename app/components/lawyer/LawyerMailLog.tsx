'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Download, Plus, Printer, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { todayIso } from '@/lib/billing';
import { CHANNEL_LABEL, DIRECTION_LABEL, deliveryState, logCsv, refNo, type Channel, type MailLogRow } from '@/lib/mailLog';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const dmy = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '');
const MISSING = /mail_log|schema cache|does not exist/i;
const EMPTY = { direction: 'in' as 'in' | 'out', channel: 'listinna' as Channel, event_on: '', counterparty: '', their_ref: '', subject: '', case_id: '', attachments: '0', note: '' };

// Podací deník: přijatá a odeslaná pošta (datovka, e-mail, listinná) s číslem jednacím kanceláře a doručením
export default function LawyerMailLog() {
    const { userId } = useLawyer();
    const [rows, setRows] = useState<MailLogRow[] | null>(null);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState('');
    const [year, setYear] = useState(Number(todayIso().slice(0, 4)));
    const [dir, setDir] = useState<'' | 'in' | 'out'>('');
    const [channel, setChannel] = useState<'' | Channel>('');
    const [pending, setPending] = useState(false);
    const [q, setQ] = useState('');
    const [form, setForm] = useState<typeof EMPTY | null>(null);
    const [busy, setBusy] = useState(false);
    const [deliver, setDeliver] = useState<{ id: string; on: string; note: string } | null>(null);

    const load = useCallback(async () => {
        const [r, c] = await Promise.all([supabase.from('mail_log').select('*').eq('year', year).order('seq', { ascending: false }).limit(2000), loadCases().catch(() => [] as LegalCase[])]);
        if (r.error) { if (MISSING.test(r.error.message)) setMissing(true); else setError(r.error.message); setRows([]); return; }
        setRows((r.data ?? []) as MailLogRow[]); setCases(c);
    }, [year]);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    const title = useCallback((id: string | null) => (id ? cases.find((c) => c.id === id)?.title ?? '' : ''), [cases]);
    const shown = useMemo(() => {
        const t = q.trim().toLowerCase();
        return (rows ?? []).filter((r) => (!dir || r.direction === dir) && (!channel || r.channel === channel) && (!pending || deliveryState(r) === 'ceka')
            && (!t || `${refNo(r)} ${r.counterparty} ${r.their_ref} ${r.subject} ${title(r.case_id)} ${r.note}`.toLowerCase().includes(t)));
    }, [rows, dir, channel, pending, q, title]);
    const waiting = (rows ?? []).filter((r) => deliveryState(r) === 'ceka').length;

    async function add() {
        if (!form) return;
        if (!form.subject.trim()) { setError('Vyplňte věc (předmět) zásilky.'); return; }
        setBusy(true); setError('');
        const { error: err } = await supabase.from('mail_log').insert({ user_id: userId, case_id: form.case_id || null, direction: form.direction, channel: form.channel, event_on: form.event_on || todayIso(), counterparty: form.counterparty.trim(), their_ref: form.their_ref.trim(), subject: form.subject.trim(), attachments: Math.max(0, Math.min(1000, Number(form.attachments) || 0)), note: form.note.trim() });
        setBusy(false);
        if (err) { setError(err.message); return; }
        setForm(null); await load();
    }
    async function markDelivered() {
        if (!deliver) return;
        const { error: err } = await supabase.from('mail_log').update({ delivered_on: deliver.on, delivery_note: deliver.note.trim().slice(0, 300) }).eq('id', deliver.id);
        if (err) { setError(err.message); return; }
        setDeliver(null); await load();
    }
    function csv() {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([logCsv(shown, title)], { type: 'text/csv;charset=utf-8' })); a.download = `podaci-denik-${year}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    function print() {
        const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const w = window.open('', '_blank'); if (!w) return;
        w.document.write(`<!doctype html><meta charset="utf-8"><title>Podací deník ${year}</title><style>body{font:11px/1.4 system-ui;margin:1.5rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left;vertical-align:top}</style><h2>Podací deník ${year}</h2><table><tr><th>Č. j.</th><th>Datum</th><th>Směr</th><th>Způsob</th><th>Odesílatel / adresát</th><th>Jejich č. j.</th><th>Věc</th><th>Spis</th><th>Doručeno</th></tr>${shown.map((r) => `<tr><td>${refNo(r)}</td><td>${dmy(r.event_on)}</td><td>${DIRECTION_LABEL[r.direction]}</td><td>${CHANNEL_LABEL[r.channel]}</td><td>${esc(r.counterparty)}</td><td>${esc(r.their_ref)}</td><td>${esc(r.subject)}</td><td>${esc(title(r.case_id))}</td><td>${dmy(r.delivered_on)}</td></tr>`).join('')}</table>`);
        w.document.close(); w.print();
    }

    if (rows === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (missing) return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Podací deník se zapne po spuštění migrace 20261118_19 v Supabase.</p>;
    const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-slate-900">Podací deník</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">Přijatá a odeslaná pošta s číslem jednacím kanceláře (řada pro každý rok). Datové zprávy a e-maily uložené do věci se sem zapíšou samy, listinnou poštu přidáte ručně. U datové schránky a listinné pošty se hlídá doručení; datum doručení datové zprávy se doplní samo z dodejky.</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...EMPTY, event_on: todayIso() })} className={primaryBtn}><Plus size={15} /> Zapsat zásilku</button>
                </div>
                {waiting > 0 && <button type="button" onClick={() => setPending(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 cursor-pointer"><Truck size={14} aria-hidden="true" /> {waiting} odeslaných zásilek čeká na doručenku</button>}
            </section>

            {form && (
                <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:grid-cols-6" aria-label="Nová zásilka">
                    <select value={form.direction} onChange={set('direction')} aria-label="Směr" className={inputCls}><option value="in">Přijato</option><option value="out">Odesláno</option></select>
                    <select value={form.channel} onChange={set('channel')} aria-label="Způsob" className={`${inputCls} sm:col-span-2`}>{(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select>
                    <input type="date" value={form.event_on} max={todayIso()} onChange={set('event_on')} aria-label="Datum" className={inputCls} />
                    <input value={form.attachments} onChange={set('attachments')} inputMode="numeric" aria-label="Počet příloh" placeholder="Příloh" className={inputCls} />
                    <select value={form.case_id} onChange={set('case_id')} aria-label="Věc" className={inputCls}><option value="">Bez věci</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                    <input value={form.counterparty} onChange={set('counterparty')} maxLength={300} placeholder={form.direction === 'in' ? 'Odesílatel' : 'Adresát'} aria-label="Odesílatel nebo adresát" className={`${inputCls} sm:col-span-3`} />
                    <input value={form.their_ref} onChange={set('their_ref')} maxLength={120} placeholder="Jejich č. j. / sp. zn." aria-label="Jejich číslo jednací" className={`${inputCls} sm:col-span-3`} />
                    <input value={form.subject} onChange={set('subject')} maxLength={300} placeholder="Věc (např. Rozsudek, Odvolání, Výzva k zaplacení)" aria-label="Věc zásilky" required className={`${inputCls} sm:col-span-4`} />
                    <input value={form.note} onChange={set('note')} maxLength={1000} placeholder="Poznámka (např. doporučeně s dodejkou)" aria-label="Poznámka" className={`${inputCls} sm:col-span-2`} />
                    <div className="flex gap-2 sm:col-span-6"><button type="submit" disabled={busy} className={primaryBtn}>Zapsat a přidělit číslo jednací</button><button type="button" onClick={() => setForm(null)} className={ghostBtn}>Zrušit</button></div>
                </form>
            )}
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Rok" className={`${inputCls} w-auto`}>{[0, 1, 2, 3].map((d) => Number(todayIso().slice(0, 4)) - d).map((y) => <option key={y}>{y}</option>)}</select>
                <select value={dir} onChange={(e) => setDir(e.target.value as '' | 'in' | 'out')} aria-label="Směr" className={`${inputCls} w-auto`}><option value="">Přijato i odesláno</option><option value="in">Jen přijato</option><option value="out">Jen odesláno</option></select>
                <select value={channel} onChange={(e) => setChannel(e.target.value as '' | Channel)} aria-label="Způsob" className={`${inputCls} w-auto`}><option value="">Všechny způsoby</option>{(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select>
                <label className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} /> Jen čekající na doručení</label>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat (č. j., adresát, věc…)" aria-label="Hledat v deníku" className={`${inputCls} min-w-48 flex-1`} />
                <button type="button" onClick={csv} disabled={!shown.length} className={ghostBtn}><Download size={14} /> CSV</button>
                <button type="button" onClick={print} disabled={!shown.length} className={ghostBtn}><Printer size={14} /> Tisk</button>
            </div>

            {shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{rows.length ? 'Nic neodpovídá filtru.' : `V roce ${year} zatím žádná zásilka.`}</p> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[880px] text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Č. j.</th><th className="px-3 py-2">Datum</th><th className="px-3 py-2">Způsob</th><th className="px-3 py-2">Odesílatel / adresát</th><th className="px-3 py-2">Věc</th><th className="px-3 py-2">Spis</th><th className="px-3 py-2">Doručení</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map((r) => {
                                const st = deliveryState(r);
                                return (
                                    <tr key={r.id} className="align-top">
                                        <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-slate-900">{refNo(r)}</td>
                                        <td className="whitespace-nowrap px-3 py-2"><span className={`inline-flex items-center gap-1 text-xs font-semibold ${r.direction === 'in' ? 'text-emerald-800' : 'text-indigo-800'}`}>{r.direction === 'in' ? <ArrowDownLeft size={12} aria-hidden="true" /> : <ArrowUpRight size={12} aria-hidden="true" />}{DIRECTION_LABEL[r.direction]}</span><span className="block text-slate-700">{dmy(r.event_on)}</span></td>
                                        <td className="px-3 py-2 text-slate-700">{CHANNEL_LABEL[r.channel]}{r.attachments ? <span className="block text-xs text-slate-500">příloh: {r.attachments}</span> : null}</td>
                                        <td className="px-3 py-2 text-slate-800">{r.counterparty || '–'}{r.their_ref && <span className="block font-mono text-xs text-slate-500">{r.their_ref}</span>}</td>
                                        <td className="px-3 py-2 text-slate-900">{r.subject}{r.note && <span className="block text-xs text-slate-500">{r.note}</span>}</td>
                                        <td className="px-3 py-2">{r.case_id ? <Link href={`/kancelar/veci/${r.case_id}`} className="text-indigo-800 hover:underline">{title(r.case_id) || 'věc'}</Link> : <span className="text-slate-400">–</span>}</td>
                                        <td className="px-3 py-2">
                                            {st === 'n/a' && <span className="text-xs text-slate-400">–</span>}
                                            {st === 'doruceno' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><CheckCircle2 size={13} aria-hidden="true" /> {dmy(r.delivered_on)}{r.delivery_note && <span className="font-normal text-slate-500"> · {r.delivery_note}</span>}</span>}
                                            {st === 'ceka' && (r.user_id === userId
                                                ? (deliver?.id === r.id
                                                    ? <form onSubmit={(e) => { e.preventDefault(); void markDelivered(); }} className="flex flex-col gap-1"><input type="date" value={deliver.on} min={r.event_on} max={todayIso()} onChange={(e) => setDeliver({ ...deliver, on: e.target.value })} aria-label="Datum doručení" className={`${inputCls} py-1 text-xs`} /><input value={deliver.note} onChange={(e) => setDeliver({ ...deliver, note: e.target.value })} placeholder="např. doručenka vrácena" aria-label="Poznámka k doručení" className={`${inputCls} py-1 text-xs`} /><span className="flex gap-1"><button type="submit" className={`${primaryBtn} px-2 py-1 text-xs`}>Uložit</button><button type="button" onClick={() => setDeliver(null)} className={`${ghostBtn} px-2 py-1 text-xs`}>×</button></span></form>
                                                    : <button type="button" onClick={() => setDeliver({ id: r.id, on: todayIso(), note: '' })} className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100 cursor-pointer">Čeká · zapsat doručení</button>)
                                                : <span className="text-xs font-semibold text-amber-900">čeká</span>)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-slate-500">Číslo jednací přiděluje databáze a nejde změnit ani smazat; opravu zapište do poznámky. Deník vidíte vy a po dobu zastupování i váš zástupce.</p>
        </div>
    );
}

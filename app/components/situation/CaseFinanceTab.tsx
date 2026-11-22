'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calculator, Clock3, FilePlus2, Loader2, Percent, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RECEIVABLE_LABELS, lineFromTimeEntry, loadReceivables, money, round2, todayIso, type Receivable } from '@/lib/billing';
import { createDraftInvoice } from '@/lib/invoiceDraft';
import { profitOf } from '@/lib/profit';
import { entryAmount, formatMinutes, parseDuration, type TimeEntry } from '@/lib/lawyer';
import { useLawyer } from '../lawyer/LawyerGate';
import { ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';
import BudgetCard from './BudgetCard';

const dateCz = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('cs-CZ');
const TONE: Record<string, string> = { draft: 'bg-slate-100 text-slate-700', paid: 'bg-emerald-100 text-emerald-900', overdue: 'bg-rose-100 text-rose-900', due_soon: 'bg-amber-100 text-amber-900', partial: 'bg-sky-100 text-sky-900', open: 'bg-indigo-100 text-indigo-900', cancelled: 'bg-slate-100 text-slate-500' };

// Peníze ve věci: odpracovaný čas, vyúčtování a platby k této věci na jednom místě, propojené s výkazy, fakturací a kalkulačkami
export default function CaseFinanceTab({ item, userId, fail, patchItem }: TabProps) {
    const { access } = useLawyer();
    const router = useRouter();
    const [entries, setEntries] = useState<TimeEntry[] | null>(null);
    const [invoices, setInvoices] = useState<Receivable[] | null>(null);
    const [clientRate, setClientRate] = useState<number | null>(null);
    const [busy, setBusy] = useState('');
    const [form, setForm] = useState({ date: todayIso(), duration: '', description: '' });
    const [error, setError] = useState('');
    const vat = !!access.vat_payer;

    const load = useCallback(async () => {
        try {
            const [e, all, c] = await Promise.all([
                supabase.from('time_entries').select('*').eq('case_id', item.id).order('entry_date', { ascending: false }),
                loadReceivables(vat, { includeDemo: true }),
                item.client_id ? supabase.from('lawyer_clients').select('hourly_rate').eq('id', item.client_id).maybeSingle() : Promise.resolve({ data: null }),
            ]);
            if (e.error) throw new Error(e.error.message);
            setEntries((e.data ?? []) as TimeEntry[]);
            setInvoices(all.filter((i) => i.case_id === item.id));
            setClientRate((c.data as { hourly_rate: number | null } | null)?.hourly_rate ?? null);
        } catch (err) { fail(err); setEntries([]); setInvoices([]); }
    }, [item.id, item.client_id, vat, fail]);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    if (entries === null || invoices === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;

    const rate = clientRate ?? access.default_rate ?? 0;
    const open = entries.filter((e) => !e.billed);
    const openMin = open.reduce((s, e) => s + e.minutes, 0);
    const openAmount = round2(open.reduce((s, e) => s + entryAmount(e), 0));
    const live = invoices.filter((i) => i.state !== 'draft' && i.state !== 'cancelled');
    const outstanding = round2(live.reduce((s, i) => s + i.outstanding, 0));
    const prof = profitOf(entries, invoices.map((i) => ({ case_id: i.case_id ?? null, status: i.status, state: i.state, base: i.base, total: i.total, paid: i.paid, currency: i.currency })));
    const paid = round2(live.reduce((s, i) => s + i.paid, 0));
    const worked = round2(entries.reduce((s, e) => s + entryAmount(e), 0));
    const billedNet = round2(live.reduce((s, i) => s + i.base, 0));

    async function addTime(e: React.FormEvent) {
        e.preventDefault();
        const minutes = parseDuration(form.duration);
        if (!minutes) { setError('Zadejte délku, např. 1:30, 1,5h nebo 45m.'); return; }
        setBusy('time'); setError('');
        const { error: err } = await supabase.from('time_entries').insert({ user_id: userId, case_id: item.id, entry_date: form.date, minutes, description: form.description.trim().slice(0, 500), rate });
        setBusy('');
        if (err) { setError(err.message); return; }
        setForm({ date: todayIso(), duration: '', description: '' });
        await load();
    }

    async function invoiceOpen() {
        setBusy('invoice'); setError('');
        try {
            const id = await createDraftInvoice({ userId, title: item.title, caseId: item.id, clientId: item.client_id ?? null, lines: open.map((e) => ({ ...lineFromTimeEntry(e, vat ? 21 : 0), time_entry_id: e.id })) });
            router.push(`/kancelar/faktury/${id}`);
        } catch (err) { setError(err instanceof Error ? err.message : 'Koncept se nepodařilo založit.'); setBusy(''); }
    }

    const tile = (label: string, value: string, note?: string, tone?: string) => <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>{note && <p className="text-xs text-slate-500">{note}</p>}</div>;

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <BudgetCard budget={item.budget_czk ?? null} warnPct={item.budget_warn_pct ?? 80} worked={worked} billed={billedNet} onSave={(b, p) => patchItem({ budget_czk: b, budget_warn_pct: p })} />
            {rate === 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Nemáte nastavenou hodinovou sazbu, takže zapsaný čas má hodnotu 0 Kč a nespotřebuje rozpočet. Nastavte ji v <Link href="/kancelar/nastaveni" className="font-semibold underline">Nastavení</Link> (výchozí sazba) nebo u klienta.</p>}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tile('K vyfakturování', money(openAmount), `${formatMinutes(openMin)} h nevyfakturované práce`)}
                {tile('Čeká na zaplacení', money(outstanding), `${live.length} vyúčtování`)}
                {tile('Zaplaceno', money(paid))}
                {tile('Po splatnosti', money(round2(live.filter((i) => i.state === 'overdue').reduce((s, i) => s + i.outstanding, 0))), undefined, live.some((i) => i.state === 'overdue') ? 'text-rose-700' : undefined)}
            </div>

            {(prof.effectiveRate !== null || prof.realization !== null) && (
                <div className="grid grid-cols-3 gap-3">
                    {tile('Za hodinu (zaplaceno)', prof.effectiveRate === null ? '–' : money(prof.effectiveRate), `z ${String(prof.hours).replace('.', ',')} h práce`)}
                    {tile('Realizace', prof.realization === null ? '–' : `${prof.realization} %`, 'vyfakturováno z hodnoty práce', prof.realization !== null && prof.realization < 70 ? 'text-amber-700' : undefined)}
                    {tile('Inkaso', prof.collection === null ? '–' : `${prof.collection} %`, 'zaplaceno z vyfakturovaného', prof.collection !== null && prof.collection < 50 ? 'text-rose-700' : undefined)}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void invoiceOpen()} disabled={open.length === 0 || busy === 'invoice'} className={primaryBtn}>{busy === 'invoice' ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />} Vyfakturovat nevyfakturovaný čas</button>
                <Link href={`/kancelar/kalkulacky?case=${item.id}`} className={ghostBtn}><Calculator size={14} /> Odměna podle tarifu</Link>
                <Link href="/kancelar/cenik" className={ghostBtn}>Ceník</Link>
            </div>

            <form onSubmit={addTime} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[9rem_8rem_1fr_auto]" aria-label="Zapsat čas">
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} aria-label="Datum" className={inputCls} />
                <input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="1:30" aria-label="Délka" className={inputCls} />
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={`Co se dělalo (sazba ${money(rate)}/h${clientRate !== null ? ', sazba klienta' : ''})`} aria-label="Popis práce" className={inputCls} />
                <button type="submit" disabled={busy === 'time' || !form.duration.trim()} className={primaryBtn}>{busy === 'time' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Zapsat čas</button>
            </form>

            <section aria-label="Výkazy práce ve spisu">
                <div className="flex items-center justify-between"><h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Clock3 size={13} /> Výkazy práce ({entries.length})</h2><Link href="/kancelar/vykazy" className="text-xs font-semibold text-indigo-800 hover:underline">Všechny výkazy</Link></div>
                {entries.length === 0 ? <p className="mt-2 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Ke spisu zatím není zapsaný žádný čas.</p> : (
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {entries.slice(0, 15).map((e) => <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><span className="w-20 shrink-0 text-xs text-slate-500">{dateCz(e.entry_date)}</span><span className="min-w-0 flex-1 truncate text-slate-800">{e.description || 'Právní služby'}</span><span className="shrink-0 text-xs text-slate-500">{formatMinutes(e.minutes)} h</span><span className="w-24 shrink-0 text-right font-semibold text-slate-900">{money(entryAmount(e))}</span><span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-bold uppercase ${e.billed ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{e.billed ? 'vyfakturováno' : 'k fakturaci'}</span></li>)}
                    </ul>
                )}
            </section>

            <section aria-label="Vyúčtování ke spisu">
                <div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vyúčtování ({invoices.length})</h2><Link href="/kancelar/faktury" className="text-xs font-semibold text-indigo-800 hover:underline">Fakturace</Link></div>
                {invoices.length === 0 ? <p className="mt-2 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Ke spisu zatím není žádné vyúčtování.</p> : (
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {invoices.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                                <Link href={`/kancelar/faktury/${i.id}`} className="min-w-0 flex-1 truncate font-semibold text-indigo-800 hover:underline">{i.number ?? 'Koncept'}<span className="ml-2 font-normal text-slate-500">{dateCz(i.issue_date)}</span></Link>
                                <span className="shrink-0 font-semibold text-slate-900">{money(i.total)}</span>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${TONE[i.state] ?? 'bg-slate-100'}`}>{RECEIVABLE_LABELS[i.state]}</span>
                                {i.state === 'overdue' && i.due_date && <Link href={`/kancelar/kalkulacky?tab=urok&jistina=${i.outstanding}&splatnost=${i.due_date}&case=${item.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 hover:underline"><Percent size={12} /> Úrok z prodlení</Link>}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

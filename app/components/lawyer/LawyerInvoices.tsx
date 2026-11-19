'use client';

import { confirmAction } from '@/lib/confirm';
import RecurringInvoices from './RecurringInvoices';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DUE_SOON_DAYS, RECEIVABLE_LABELS, loadReceivables, money, round2, todayIso, type Receivable, type ReceivableState } from '@/lib/billing';
import { inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const TONE: Record<ReceivableState, string> = { draft: 'bg-slate-100 text-slate-700', cancelled: 'bg-slate-100 text-slate-500', paid: 'bg-emerald-100 text-emerald-900', overdue: 'bg-rose-100 text-rose-900', due_soon: 'bg-amber-100 text-amber-900', partial: 'bg-sky-100 text-sky-900', open: 'bg-indigo-100 text-indigo-900' };
const dateCz = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');
type Filter = 'all' | 'unpaid' | 'overdue' | 'due_soon' | 'paid' | 'draft';
const FILTERS: [Filter, string][] = [['all', 'Vše'], ['unpaid', 'Nezaplacené'], ['overdue', 'Po splatnosti'], ['due_soon', `Splatnost do ${DUE_SOON_DAYS} dní`], ['paid', 'Zaplacené'], ['draft', 'Koncepty']];
const matches = (r: Receivable, f: Filter) => f === 'all' ? r.state !== 'cancelled' : f === 'unpaid' ? ['open', 'partial', 'due_soon', 'overdue'].includes(r.state) : f === 'draft' ? r.state === 'draft' : r.state === f;

function dueText(r: Receivable): string {
    if (r.state === 'paid' || r.state === 'draft' || r.state === 'cancelled' || r.daysToDue === null) return dateCz(r.due_date);
    if (r.daysToDue < 0) return `${dateCz(r.due_date)} · ${-r.daysToDue} dní po`;
    if (r.daysToDue === 0) return `${dateCz(r.due_date)} · dnes`;
    return `${dateCz(r.due_date)} · za ${r.daysToDue} dní`;
}

// Přehled vyúčtování a pohledávek: co je zaplacené, co ne a co se blíží splatnosti
export default function LawyerInvoices() {
    const { userId, access } = useLawyer();
    const router = useRouter();
    const [rows, setRows] = useState<Receivable[] | null>(null);
    const [filter, setFilter] = useState<Filter>('unpaid');
    const [view, setView] = useState<'list' | 'clients'>('list');
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const vatNow = !!access.vat_payer;

    const load = useCallback(async () => {
        try { setRows(await loadReceivables(vatNow)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se načíst.'); setRows([]); }
    }, [vatNow]);

    useEffect(() => {
        let cancelled = false;
        void (async () => { await Promise.resolve(); if (!cancelled) await load(); })();
        return () => { cancelled = true; };
    }, [load]);

    async function create(caseId?: string) {
        setBusy(true);
        // Vyúčtování konkrétní věci (z přehledu Dnes): předvyplní věc a klienta a rovnou nabídne nevyúčtované výkazy
        let link: { case_id?: string; client_id?: string | null } = {};
        if (caseId) {
            const { data: c } = await supabase.from('cases').select('id, client_id').eq('id', caseId).maybeSingle();
            if (c) link = { case_id: (c as { id: string }).id, client_id: (c as { client_id?: string | null }).client_id ?? null };
        }
        const { data, error: err } = await supabase.from('invoices').insert({ user_id: userId, issue_date: todayIso(), ...link }).select('id').single();
        setBusy(false);
        if (err) { setError(err.message); return; }
        router.push(`/kancelar/faktury/${(data as { id: string }).id}${link.case_id ? '?vykazy=1' : ''}`);
    }
    const started = useRef(false);
    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        const caseId = q.get('case');
        if (q.get('nove') !== '1' || !caseId || !/^[0-9a-f-]{36}$/i.test(caseId) || started.current) return;
        started.current = true;
        window.history.replaceState(null, '', window.location.pathname);
        const t = window.setTimeout(() => { void create(caseId); }, 0);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Zaškrtnutí „zaplaceno“: zapíše platbu na zbývající částku; odškrtnutí platby smaže
    async function togglePaid(r: Receivable) {
        setError('');
        if (r.state === 'paid') {
            if (!await confirmAction('Vrátit vyúčtování mezi nezaplacené? Zapsané platby se smažou.')) return;
            const del = await supabase.from('invoice_payments').delete().eq('invoice_id', r.id);
            if (del.error) { setError(del.error.message); return; }
            const up = await supabase.from('invoices').update({ status: 'issued', paid_at: null }).eq('id', r.id);
            if (up.error) { setError(up.error.message); return; }
        } else {
            if (r.outstanding > 0) {
                const ins = await supabase.from('invoice_payments').insert({ invoice_id: r.id, user_id: userId, amount: r.outstanding, paid_on: todayIso() });
                if (ins.error) { setError(ins.error.message); return; }
            }
            const up = await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', r.id);
            if (up.error) { setError(up.error.message); return; }
        }
        await load();
    }

    const q = query.trim().toLowerCase();
    const shown = useMemo(() => (rows ?? []).filter((r) => matches(r, filter) && (!q || `${r.number ?? ''} ${r.title} ${r.client_snapshot.name ?? ''}`.toLowerCase().includes(q))), [rows, filter, q]);
    const live = (rows ?? []).filter((r) => r.state !== 'draft' && r.state !== 'cancelled');
    const sum = (list: Receivable[], f: (r: Receivable) => number) => round2(list.reduce((s, r) => s + f(r), 0));
    const unpaid = live.filter((r) => r.state !== 'paid');
    const overdue = live.filter((r) => r.state === 'overdue');
    const soon = live.filter((r) => r.state === 'due_soon');
    const counts = (f: Filter) => (rows ?? []).filter((r) => matches(r, f)).length;

    // Souhrn po klientech
    const byClient = useMemo(() => {
        const map = new Map<string, { name: string; items: Receivable[] }>();
        for (const r of shown) { const key = r.client_id ?? `n:${r.client_snapshot.name ?? ''}`; const g = map.get(key) ?? { name: r.client_snapshot.name || 'Bez odběratele', items: [] }; g.items.push(r); map.set(key, g); }
        return [...map.entries()].map(([key, g]) => ({ key, ...g, outstanding: sum(g.items.filter((r) => r.state !== 'paid' && r.state !== 'draft'), (r) => r.outstanding), paid: sum(g.items, (r) => r.paid), overdue: sum(g.items.filter((r) => r.state === 'overdue'), (r) => r.outstanding) })).sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding || a.name.localeCompare(b.name, 'cs'));
    }, [shown]);

    const Tile = ({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) => <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone || 'text-slate-900'}`}>{value}</p>{note && <p className="text-xs text-slate-500">{note}</p>}</div>;

    const table = (list: Receivable[]) => (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-10 px-3 py-2.5"><span className="sr-only">Zaplaceno</span></th><th className="px-3 py-2.5">Číslo</th><th className="px-3 py-2.5">Odběratel</th><th className="px-3 py-2.5">Splatnost</th><th className="px-3 py-2.5">Stav</th><th className="px-3 py-2.5 text-right">Částka</th><th className="px-3 py-2.5 text-right">Zbývá</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {list.map((r) => (
                        <tr key={r.id} className={r.state === 'overdue' ? 'bg-rose-50/50' : r.state === 'due_soon' ? 'bg-amber-50/50' : ''}>
                            <td className="px-3 py-2.5">{r.state !== 'draft' && r.state !== 'cancelled' && <input type="checkbox" checked={r.state === 'paid'} onChange={() => void togglePaid(r)} aria-label={`Zaplaceno: ${r.number ?? 'vyúčtování'}`} className="h-4 w-4 cursor-pointer accent-emerald-600" />}</td>
                            <td className="px-3 py-2.5 font-semibold"><Link href={`/kancelar/faktury/${r.id}`} className="text-indigo-800 hover:underline">{r.number ?? 'Koncept'}</Link>{r.title && <span className="block text-xs font-normal text-slate-500">{r.title}</span>}</td>
                            <td className="px-3 py-2.5 text-slate-700">{r.client_snapshot.name || '–'}{r.case_id && <Link href={`/kancelar/veci/${r.case_id}`} className="block text-xs font-semibold text-indigo-800 hover:underline">Otevřít věc</Link>}</td>
                            <td className={`px-3 py-2.5 ${r.state === 'overdue' ? 'font-bold text-rose-700' : r.state === 'due_soon' ? 'font-semibold text-amber-800' : 'text-slate-700'}`}>{dueText(r)}</td>
                            <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[r.state]}`}>{RECEIVABLE_LABELS[r.state]}</span>{r.state === 'overdue' && r.due_date && r.currency === 'CZK' && <Link href={`/kancelar/kalkulacky?tab=urok&jistina=${r.outstanding}&splatnost=${r.due_date}${r.case_id ? `&case=${r.case_id}` : ''}`} className="mt-1 block text-xs font-semibold text-rose-800 hover:underline">Spočítat úrok z prodlení</Link>}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{money(r.total, r.currency)}</td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${r.state === 'paid' ? 'text-slate-400' : 'text-slate-900'}`}>{r.state === 'draft' || r.state === 'cancelled' ? '–' : money(r.outstanding, r.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Čeká na zaplacení" value={money(sum(unpaid, (r) => r.outstanding))} note={`${unpaid.length} vyúčtování`} />
                <Tile label="Po splatnosti" value={money(sum(overdue, (r) => r.outstanding))} tone={overdue.length ? 'text-rose-700' : ''} note={`${overdue.length} vyúčtování`} />
                <Tile label={`Splatnost do ${DUE_SOON_DAYS} dní`} value={money(sum(soon, (r) => r.outstanding))} tone={soon.length ? 'text-amber-700' : ''} note={`${soon.length} vyúčtování`} />
                <Tile label="Zaplaceno celkem" value={money(sum(live, (r) => r.paid))} />
            </div>
            <RecurringInvoices onCreated={load} />
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void create()} disabled={busy} className={primaryBtn}><Plus size={16} /> Nové vyúčtování</button>
                <div className="ml-auto inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Zobrazení">
                    {([['list', 'Seznam'], ['clients', 'Podle klientů']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>{label}</button>)}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-full border px-3.5 py-1 text-xs font-semibold ${filter === id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{label} ({counts(id)})</button>)}
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Číslo, klient…" aria-label="Hledat" className={`${inputCls} ml-auto max-w-52`} />
            </div>

            {rows === null ? <p className="text-sm text-slate-500" role="status">Načítám…</p> : shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{rows.length ? 'Nic neodpovídá filtru.' : 'Zatím žádná vyúčtování. Vytvořte první a vyberte položky z ceníku nebo z výkazů práce.'}</p> : view === 'list' ? table(shown) : (
                <div className="space-y-4">
                    {byClient.map((g) => (
                        <section key={g.key} className="rounded-2xl border border-slate-200 bg-white p-4" aria-label={g.name}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h2 className="text-base font-bold text-slate-900">{g.name}</h2>
                                <p className="text-sm text-slate-600">Zbývá zaplatit <strong className="text-slate-900">{money(g.outstanding)}</strong>{g.overdue > 0 && <> · po splatnosti <strong className="text-rose-700">{money(g.overdue)}</strong></>} · zaplaceno {money(g.paid)}</p>
                            </div>
                            <div className="mt-3">{table(g.items)}</div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

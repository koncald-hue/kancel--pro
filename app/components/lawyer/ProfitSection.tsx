'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { loadReceivables, money, todayIso } from '@/lib/billing';
import { groupProfit, type Entry, type Group, type Inv } from '@/lib/profit';
import { useLawyer } from './LawyerGate';
import { inputCls } from '../situation/caseUi';
import { DEMO_MARK_LIKE } from '@/lib/demoMarks';

const KEY = 'kancelar-cost-rate';
type Period = 'month' | 'quarter' | 'year' | 'all';
const PERIODS: [Period, string][] = [['month', 'Tento měsíc'], ['quarter', 'Čtvrtletí'], ['year', 'Letos'], ['all', 'Vše']];
function fromDate(p: Period, today: string): string {
    const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    if (p === 'month') return `${today.slice(0, 7)}-01`;
    if (p === 'quarter') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
    if (p === 'year') return `${y}-01-01`;
    return '0000-01-01';
}
const pct = (n: number | null) => (n === null ? '–' : `${n} %`);

// Rentabilita: kolik jednotlivé věci a klienti skutečně vydělávají na odpracovanou hodinu
export default function ProfitSection() {
    const { access } = useLawyer();
    const [by, setBy] = useState<'case' | 'client'>('case');
    const [data, setData] = useState<{ cases: LegalCase[]; entries: Entry[]; invoices: Inv[] } | null>(null);
    const [cost, setCost] = useState('');
    const [period, setPeriod] = useState<Period>('all');
    useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) { const t = window.setTimeout(() => setCost(v), 0); return () => window.clearTimeout(t); } } catch { /* nic */ } }, []);
    useEffect(() => {
        let alive = true;
        (async () => {
            const [cases, e, inv] = await Promise.all([loadCases(), supabase.from('time_entries').select('case_id, entry_date, minutes, rate, billed').not('description', 'ilike', DEMO_MARK_LIKE), loadReceivables(!!access.vat_payer)]);
            if (alive) setData({ cases, entries: (e.data ?? []) as Entry[], invoices: inv.map((i) => ({ issue_date: i.issue_date, case_id: i.case_id ?? null, status: i.status, state: i.state, base: i.base, total: i.total, paid: i.paid, currency: i.currency })) });
        })().catch(() => { if (alive) setData({ cases: [], entries: [], invoices: [] }); });
        return () => { alive = false; };
    }, [access.vat_payer]);

    if (!data) return null;
    const costNum = Number(cost.replace(',', '.')) > 0 ? Number(cost.replace(',', '.')) : null;
    const from = fromDate(period, todayIso());
    const groups: Group[] = groupProfit(by, data.cases, data.entries.filter((e) => (e.entry_date ?? '9') >= from), data.invoices.filter((i) => (i.issue_date ?? '9') >= from), costNum).filter((g) => g.profit.hours > 0 || g.profit.billed > 0);
    if (groups.length === 0 && period === 'all') return null;
    return (
        <section aria-label="Rentabilita" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><TrendingUp size={13} /> Rentabilita</h2>
                <div className="flex flex-wrap items-center gap-3">
                    <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Období" className={`${inputCls} w-auto py-1 text-xs`}>{PERIODS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">Moje náklady na hodinu <input value={cost} onChange={(e) => { setCost(e.target.value); try { localStorage.setItem(KEY, e.target.value); } catch { /* nic */ } }} inputMode="decimal" placeholder="nepovinné" aria-label="Náklady na hodinu (Kč)" className={`${inputCls} w-24 py-1`} /></label>
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">{([['case', 'Spisy'], ['client', 'Klienti']] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={by === id} onClick={() => setBy(id)} className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${by === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{l}</button>)}</div>
                </div>
            </div>
            {groups.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">V tomto období není zapsaná práce ani faktura.</p>}
            {groups.length > 0 && groups.some((g) => g.profit.unbilledValue > 0) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Nevyfakturovaná práce celkem: <strong>{money(groups.reduce((s, g) => s + g.profit.unbilledValue, 0))}</strong> (bez DPH). Nejvíc čeká ve {by === 'case' ? 'spisu' : 'u klienta'} <strong>{[...groups].sort((a, b) => b.profit.unbilledValue - a.profit.unbilledValue)[0].name}</strong>.</p>}
            {groups.length > 0 && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">{by === 'case' ? 'Spis' : 'Klient'}</th><th className="px-3 py-2 text-right">Hodin</th><th className="px-3 py-2 text-right">Hodnota práce</th><th className="px-3 py-2 text-right">K vyfakturování</th><th className="px-3 py-2 text-right">Vyfakturováno</th><th className="px-3 py-2 text-right">Zaplaceno</th><th className="px-3 py-2 text-right">Za hodinu</th><th className="px-3 py-2 text-right">Realizace</th><th className="px-3 py-2 text-right">Inkaso</th>{costNum && <th className="px-3 py-2 text-right">Zisk</th>}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {groups.slice(0, 25).map((g) => (
                            <tr key={g.id}>
                                <td className="px-4 py-2 font-semibold text-slate-900">{by === 'case' ? <Link href={`/kancelar/veci/${g.id}`} className="text-indigo-800 hover:underline">{g.name}</Link> : g.name}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{g.profit.hours.toString().replace('.', ',')}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{money(g.profit.workValue)}</td>
                                <td className={`px-3 py-2 text-right ${g.profit.unbilledValue > 0 ? 'font-semibold text-amber-800' : 'text-slate-400'}`}>{money(g.profit.unbilledValue)}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{money(g.profit.billed)}</td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-800">{money(g.profit.paid)}</td>
                                <td className={`px-3 py-2 text-right font-semibold ${g.profit.effectiveRate !== null && costNum !== null && g.profit.effectiveRate < costNum ? 'text-rose-700' : 'text-slate-900'}`}>{g.profit.effectiveRate === null ? '–' : money(g.profit.effectiveRate)}</td>
                                <td className={`px-3 py-2 text-right ${g.profit.realization !== null && g.profit.realization < 70 ? 'font-semibold text-amber-800' : 'text-slate-700'}`}>{pct(g.profit.realization)}</td>
                                <td className={`px-3 py-2 text-right ${g.profit.collection !== null && g.profit.collection < 50 ? 'font-semibold text-rose-700' : 'text-slate-700'}`}>{pct(g.profit.collection)}</td>
                                {costNum && <td className={`px-3 py-2 text-right font-semibold ${(g.profit.margin ?? 0) < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{g.profit.margin === null ? '–' : money(g.profit.margin)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>}
            <p className="text-xs leading-relaxed text-slate-500"><strong>Za hodinu</strong> = zaplaceno bez DPH ÷ odpracované hodiny (skutečný výdělek). <strong>Realizace</strong> = vyfakturováno ÷ hodnota práce (kolik z odpracovaného jste dokázali vyúčtovat). <strong>Inkaso</strong> = zaplaceno ÷ vyfakturováno. Počítají se koruny bez DPH; koncepty a storno ne. Spisy bez zapsaného času ukazují jen fakturaci.</p>
        </section>
    );
}

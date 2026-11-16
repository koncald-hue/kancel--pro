'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { loadReceivables, money } from '@/lib/billing';
import { groupProfit, type Entry, type Group, type Inv } from '@/lib/profit';
import { useLawyer } from './LawyerGate';
import { inputCls } from '../situation/caseUi';

const KEY = 'kancelar-cost-rate';
const pct = (n: number | null) => (n === null ? '–' : `${n} %`);

// Rentabilita: kolik jednotlivé věci a klienti skutečně vydělávají na odpracovanou hodinu
export default function ProfitSection() {
    const { access } = useLawyer();
    const [by, setBy] = useState<'case' | 'client'>('case');
    const [data, setData] = useState<{ cases: LegalCase[]; entries: Entry[]; invoices: Inv[] } | null>(null);
    const [cost, setCost] = useState('');
    useEffect(() => { try { const v = localStorage.getItem(KEY); if (v) { const t = window.setTimeout(() => setCost(v), 0); return () => window.clearTimeout(t); } } catch { /* nic */ } }, []);
    useEffect(() => {
        let alive = true;
        (async () => {
            const [cases, e, inv] = await Promise.all([loadCases(), supabase.from('time_entries').select('case_id, minutes, rate, billed'), loadReceivables(!!access.vat_payer)]);
            if (alive) setData({ cases, entries: (e.data ?? []) as Entry[], invoices: inv.map((i) => ({ case_id: i.case_id ?? null, status: i.status, state: i.state, base: i.base, total: i.total, paid: i.paid, currency: i.currency })) });
        })().catch(() => { if (alive) setData({ cases: [], entries: [], invoices: [] }); });
        return () => { alive = false; };
    }, [access.vat_payer]);

    if (!data) return null;
    const costNum = Number(cost.replace(',', '.')) > 0 ? Number(cost.replace(',', '.')) : null;
    const groups: Group[] = groupProfit(by, data.cases, data.entries, data.invoices, costNum).filter((g) => g.profit.hours > 0 || g.profit.billed > 0);
    if (groups.length === 0) return null;
    return (
        <section aria-label="Rentabilita" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><TrendingUp size={13} /> Rentabilita</h2>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">Moje náklady na hodinu <input value={cost} onChange={(e) => { setCost(e.target.value); try { localStorage.setItem(KEY, e.target.value); } catch { /* nic */ } }} inputMode="decimal" placeholder="nepovinné" aria-label="Náklady na hodinu (Kč)" className={`${inputCls} w-24 py-1`} /></label>
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">{([['case', 'Věci'], ['client', 'Klienti']] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={by === id} onClick={() => setBy(id)} className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${by === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{l}</button>)}</div>
                </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">{by === 'case' ? 'Věc' : 'Klient'}</th><th className="px-3 py-2 text-right">Hodin</th><th className="px-3 py-2 text-right">Hodnota práce</th><th className="px-3 py-2 text-right">Vyfakturováno</th><th className="px-3 py-2 text-right">Zaplaceno</th><th className="px-3 py-2 text-right">Za hodinu</th><th className="px-3 py-2 text-right">Realizace</th><th className="px-3 py-2 text-right">Inkaso</th>{costNum && <th className="px-3 py-2 text-right">Zisk</th>}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {groups.slice(0, 25).map((g) => (
                            <tr key={g.id}>
                                <td className="px-4 py-2 font-semibold text-slate-900">{by === 'case' ? <Link href={`/kancelar/veci/${g.id}`} className="text-indigo-800 hover:underline">{g.name}</Link> : g.name}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{g.profit.hours.toString().replace('.', ',')}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{money(g.profit.workValue)}</td>
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
            </div>
            <p className="text-xs leading-relaxed text-slate-500"><strong>Za hodinu</strong> = zaplaceno bez DPH ÷ odpracované hodiny (skutečný výdělek). <strong>Realizace</strong> = vyfakturováno ÷ hodnota práce (kolik z odpracovaného jste dokázali vyúčtovat). <strong>Inkaso</strong> = zaplaceno ÷ vyfakturováno. Počítají se koruny bez DPH; koncepty a storno ne. Věci bez zapsaného času ukazují jen fakturaci.</p>
        </section>
    );
}

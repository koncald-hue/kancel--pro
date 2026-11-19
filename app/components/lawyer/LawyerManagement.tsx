'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, TrendingDown, TrendingUp } from 'lucide-react';
import ProfitSection from './ProfitSection';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { czk, formatMinutes } from '@/lib/lawyer';
import { teamStats } from '@/lib/teamProfit';
import { byCase, byWeek, changePct, forecast, inMonth, monthEnd, monthOf, monthStart, shiftMonth, sumEntries, type Entry } from '@/lib/mgmt';

type Member = { user_id: string; name: string; shared: boolean; minutes: number | null; amount: number | null; billed_minutes: number | null };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthName = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
const hours = (m: number) => `${(m / 60).toFixed(1).replace('.', ',')} h`;

function Change({ cur, prev }: { cur: number; prev: number }) {
    const p = changePct(cur, prev);
    if (p === null) return <span className="text-xs text-slate-500">minulý měsíc bez záznamů</span>;
    const up = p >= 0; const Icon = up ? TrendingUp : TrendingDown;
    return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-700' : 'text-rose-700'}`}><Icon size={13} aria-hidden="true" /> {up ? '+' : ''}{p} % proti minulému měsíci</span>;
}

function Bars({ rows }: { rows: { key: string; label: string; value: number; note: string }[] }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <ul className="space-y-2">
            {rows.map((r) => (
                <li key={r.key} className="text-sm">
                    <div className="flex justify-between gap-3"><span className="truncate text-slate-800">{r.label}</span><span className="shrink-0 text-slate-600">{r.note}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-700" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
                </li>
            ))}
        </ul>
    );
}

// Přehled pro vedení: můj měsíc proti minulému, prognóza, týdny, věci a (dobrovolně sdílené) hodiny kolegů
export default function LawyerManagement() {
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [error, setError] = useState('');
    const [role, setRole] = useState<'owner' | 'member' | null>(null);
    const [members, setMembers] = useState<Member[] | null>(null);
    const [share, setShare] = useState<boolean | null>(null);
    const today = todayIso(); const ym = monthOf(today); const prev = shiftMonth(ym, -1);

    useEffect(() => {
        let alive = true;
        (async () => {
            const [e, c, f] = await Promise.all([
                supabase.from('time_entries').select('case_id, entry_date, minutes, rate, billed').gte('entry_date', monthStart(prev)).lte('entry_date', monthEnd(ym)),
                loadCases().catch(() => [] as LegalCase[]),
                supabase.rpc('firm_overview'),
            ]);
            if (!alive) return;
            if (e.error) { setError('Výkazy se nepodařilo načíst.'); return; }
            setEntries((e.data ?? []) as Entry[]); setCases(c);
            const r = (f.data as { firm?: { role: 'owner' | 'member' } } | null)?.firm?.role ?? null; setRole(r);
            if (r === 'owner') {
                const t = await supabase.rpc('team_hours', { p_from: monthStart(ym), p_to: monthEnd(ym) });
                if (alive) setMembers(t.error ? [] : ((t.data ?? []) as Member[]));
            } else if (r === 'member') {
                const own = await supabase.from('time_sharing').select('share').maybeSingle();
                if (alive) setShare(own.error ? null : (own.data?.share ?? false));
            }
        })().catch(() => { if (alive) setError('Přehled se nepodařilo načíst.'); });
        return () => { alive = false; };
    }, [ym, prev]);

    async function toggleShare(on: boolean) {
        const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
        const { error: err } = await supabase.from('time_sharing').upsert({ user_id: u.user.id, share: on, updated_at: new Date().toISOString() });
        if (err) setError('Nastavení se nepodařilo uložit. Zkontrolujte, že je spuštěná migrace 20261118_11.'); else setShare(on);
    }

    const view = useMemo(() => {
        if (!entries) return null;
        const cur = sumEntries(inMonth(entries, ym)); const old = sumEntries(inMonth(entries, prev));
        const titles = new Map(cases.map((c) => [c.id, c.title]));
        return {
            cur, old, fc: forecast(entries, today),
            weeks: byWeek(inMonth(entries, ym)),
            cases: byCase(inMonth(entries, ym)).slice(0, 8).map((r) => ({ ...r, title: r.caseId ? (titles.get(r.caseId) ?? 'Věc') : 'Čas bez přiřazené věci' })),
        };
    }, [entries, cases, ym, prev, today]);

    if (error) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>;
    if (!view) return <p className="text-sm text-slate-500" role="status">Načítám přehled…</p>;
    const { cur, old, fc } = view;
    const card = 'rounded-2xl border border-slate-200 bg-white p-5';

    return (
        <div className="space-y-5">
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">Přehled, jak se vám daří tento měsíc. Vychází z času, který zapisujete u věcí (Výkazy práce): kolik jste odpracovali, jakou to má hodnotu podle vaší sazby a kolik z toho už je vyfakturováno. Prognóza odhaduje konec měsíce podle dosavadního tempa. Pokud pracujete sami, najdete tu jen své číslo, výkon kolegů uvidí vedoucí kanceláře.</p>
            <section className="grid gap-4 md:grid-cols-3">
                <div className={card}><p className="text-sm text-slate-500">Hodiny, {monthName(ym)}</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{formatMinutes(cur.minutes)}</p><p className="mt-1"><Change cur={cur.minutes} prev={old.minutes} /></p><p className="mt-1 text-xs text-slate-500">Minulý měsíc: {formatMinutes(old.minutes)}</p></div>
                <div className={card}><p className="text-sm text-slate-500">Hodnota práce</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{czk(cur.amount)}</p><p className="mt-1"><Change cur={cur.amount} prev={old.amount} /></p><p className="mt-1 text-xs text-slate-500">Z toho vyfakturováno {czk(cur.billedAmount)}, k vyfakturování {czk(cur.amount - cur.billedAmount)}</p></div>
                <div className={card}>
                    <p className="text-sm text-slate-500">Prognóza do konce měsíce</p><p className="mt-1 text-3xl font-extrabold text-slate-900">{czk(fc.amount)}</p>
                    <p className="mt-1 text-xs text-slate-600">{hours(fc.minutes)} při dosavadním tempu ({fc.elapsed} z {fc.total} pracovních dnů).</p>
                    {!fc.reliable && <p className="mt-1 text-xs text-amber-800">Začátek měsíce, odhad je zatím hrubý.</p>}
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
                <div className={card}>
                    <h2 className="text-base font-bold text-slate-900">Hodiny po týdnech</h2>
                    {view.weeks.length === 0 ? <p className="mt-3 text-sm text-slate-500">Tento měsíc zatím nejsou žádné výkazy.</p> :
                        <div className="mt-3"><Bars rows={view.weeks.map((w) => ({ key: w.week, label: `týden od ${new Date(`${w.week}T12:00:00`).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}`, value: w.minutes, note: `${hours(w.minutes)} · ${czk(w.amount)}` }))} /></div>}
                </div>
                <div className={card}>
                    <h2 className="text-base font-bold text-slate-900">Nejvíc práce podle věcí</h2>
                    {view.cases.length === 0 ? <p className="mt-3 text-sm text-slate-500">Tento měsíc zatím nejsou žádné výkazy.</p> :
                        <div className="mt-3"><Bars rows={view.cases.map((c) => ({ key: c.caseId ?? 'none', label: c.title, value: c.amount, note: `${hours(c.minutes)} · ${czk(c.amount)}` }))} /></div>}
                </div>
            </section>

            {role === 'owner' && members && (
                <section className={card} aria-labelledby="mg-team">
                    <h2 id="mg-team" className="text-base font-bold text-slate-900">Výkon podle právníků ({monthName(ym)})</h2>
                    <p className="mt-1 text-sm text-slate-600">Hodiny kolegy uvidíte jen tehdy, když je sám zapne ve svém Přehledu. Ostatní se tu zobrazí bez čísel. Sdílí se jen součty za měsíc, nikdy popisy ani věci.</p>
                    {(() => {
                        const t = teamStats(members);
                        return (
                            <>
                                {t.rows.length > 0 && (
                                    <div className="mt-3 overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-3">Právník</th><th className="px-3 py-2 text-right">Hodin</th><th className="px-3 py-2 text-right">Hodnota práce</th><th className="px-3 py-2 text-right">Za hodinu</th><th className="px-3 py-2 text-right">K vyfakturování</th><th className="py-2 pl-3 text-right">Realizace</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {t.rows.map((r) => (
                                                    <tr key={r.user_id}>
                                                        <td className="py-2 pr-3 font-semibold text-slate-900">{r.name}</td>
                                                        <td className="px-3 py-2 text-right text-slate-700">{String(r.hours).replace('.', ',')}</td>
                                                        <td className="px-3 py-2 text-right text-slate-700">{czk(r.value)}</td>
                                                        <td className="px-3 py-2 text-right text-slate-700">{r.avgRate === null ? '–' : czk(r.avgRate)}</td>
                                                        <td className={`px-3 py-2 text-right ${r.unbilledValue > 0 ? 'font-semibold text-amber-800' : 'text-slate-400'}`}>{czk(r.unbilledValue)}</td>
                                                        <td className={`py-2 pl-3 text-right ${r.realization !== null && r.realization < 70 ? 'font-semibold text-amber-800' : 'text-slate-700'}`}>{r.realization === null ? '–' : `${r.realization} %`}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50 font-bold text-slate-900"><td className="py-2 pr-3">Celkem ({t.totals.sharing} z {t.totals.total})</td><td className="px-3 py-2 text-right">{String(t.totals.hours).replace('.', ',')}</td><td className="px-3 py-2 text-right">{czk(t.totals.value)}</td><td className="px-3 py-2 text-right">{t.totals.hours > 0 ? czk(Math.round(t.totals.value / t.totals.hours)) : '–'}</td><td className="px-3 py-2 text-right">{czk(t.totals.unbilledValue)}</td><td className="py-2 pl-3 text-right">{t.totals.realization === null ? '–' : `${t.totals.realization} %`}</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {t.hidden.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500"><EyeOff size={14} aria-hidden="true" /> Nesdílí hodiny: {t.hidden.join(', ')}. Čísla se jim nezapočítávají.</p>}
                            </>
                        );
                    })()}
                </section>
            )}
            {role === 'member' && share !== null && (
                <section className={card}>
                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Eye size={16} className="text-indigo-700" aria-hidden="true" /> Sdílení hodin s vedoucím kanceláře</h2>
                    <p className="mt-1 text-sm text-slate-600">Ve výchozím stavu vedoucí vaše hodiny nevidí. Když sdílení zapnete, uvidí součet hodin a částek za měsíc, nikdy popisy ani věci. Vypnout ho můžete kdykoli.</p>
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={share} onChange={(e) => void toggleShare(e.target.checked)} /> Sdílet měsíční součty hodin</label>
                </section>
            )}
            <ProfitSection />
            <p className="text-xs text-slate-500">Přehled vychází z vašich výkazů práce. <Link href="/kancelar/vykazy" className="underline">Otevřít výkazy</Link>. Prognóza je jen lineární odhad z dosavadního tempa a svátků, ne příslib.</p>
        </div>
    );
}

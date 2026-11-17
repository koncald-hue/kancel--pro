'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseDuration, type TimeEntry } from '@/lib/lawyer';
import type { LegalCase } from '@/lib/cases';
import { fmtMinutes, pragueDay, suggest, type Activity, type Suggestion } from '@/lib/workLog';
import { inputCls, primaryBtn } from '../situation/caseUi';

const UNIT_KEY = 'kancelar-vykaz-jednotka';
const DAYS = 14;
const since = () => new Date(Date.now() - DAYS * 86_400_000).toISOString();
const sinceDay = () => pragueDay(since());

async function loadData(): Promise<{ acts: Activity[]; logged: { case_id: string | null; entry_date: string; minutes: number }[] } | null> {
    const [a, t] = await Promise.all([
        supabase.from('work_activity').select('id, case_id, kind, label, words, at, time_entry_id, dismissed').gte('at', since()).order('at'),
        supabase.from('time_entries').select('case_id, entry_date, minutes').gte('entry_date', sinceDay()),
    ]);
    if (a.error) return null;
    return { acts: (a.data ?? []) as Activity[], logged: (t.data ?? []) as { case_id: string | null; entry_date: string; minutes: number }[] };
}
const readUnit = () => { try { const v = Number(localStorage.getItem(UNIT_KEY)); return [5, 6, 10, 15, 30].includes(v) ? v : 15; } catch { return 15; } };
const dayLabel = (d: string) => { const today = pragueDay(new Date().toISOString()); const y = pragueDay(new Date(Date.now() - 86_400_000).toISOString()); return d === today ? 'Dnes' : d === y ? 'Včera' : new Date(`${d}T12:00:00`).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' }); };

// Návrh výkazu: co advokát v aplikaci udělal, poskládané po věcech a dnech. Zapíše se jen to, co potvrdí.
export default function WorkSuggestions({ userId, cases, rateFor, onAdded }: { userId: string; cases: LegalCase[]; rateFor: (caseId: string) => number; onAdded: (rows: TimeEntry[]) => void }) {
    const [data, setData] = useState<Awaited<ReturnType<typeof loadData>> | undefined>(undefined);
    const [unit, setUnit] = useState(15);
    const [edit, setEdit] = useState<Record<string, { minutes?: string; description?: string; caseId?: string; off?: boolean }>>({});
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const reload = useCallback(async () => setData(await loadData().catch(() => null)), []);
    useEffect(() => { const t = window.setTimeout(() => { setUnit(readUnit()); void reload(); }, 0); return () => window.clearTimeout(t); }, [reload]);

    const list = useMemo(() => (data ? suggest(data.acts, data.logged, { unit }) : []), [data, unit]);
    const title = (id: string | null) => (id ? cases.find((c) => c.id === id)?.title ?? 'Věc' : 'Bez věci');
    const val = (s: Suggestion) => ({ minutes: edit[s.key]?.minutes ?? fmtMinutes(s.minutes), description: edit[s.key]?.description ?? s.description, caseId: edit[s.key]?.caseId ?? s.caseId ?? '', on: !edit[s.key]?.off });
    const set = (key: string, patch: Partial<{ minutes: string; description: string; caseId: string; off: boolean }>) => setEdit((e) => ({ ...e, [key]: { ...e[key], ...patch } }));

    async function confirm() {
        setBusy(true); setMsg('');
        const rows: TimeEntry[] = []; let total = 0;
        try {
            for (const s of list) {
                const v = val(s); if (!v.on) continue;
                const minutes = parseDuration(v.minutes); if (!minutes) continue;
                const { data: row, error } = await supabase.from('time_entries').insert({ user_id: userId, case_id: v.caseId || null, entry_date: s.day, minutes, description: v.description.trim().slice(0, 500), rate: rateFor(v.caseId) }).select('*').single();
                if (error) throw new Error(error.message);
                await supabase.from('work_activity').update({ time_entry_id: (row as TimeEntry).id }).in('id', s.activityIds);
                rows.push(row as TimeEntry); total += minutes;
            }
            onAdded(rows); setEdit({}); await reload();
            setMsg(rows.length ? `Zapsáno ${rows.length} položek, celkem ${fmtMinutes(total)} h.` : 'Nic nebylo vybráno.');
        } catch (e) { setMsg(e instanceof Error ? e.message : 'Zápis se nepovedl.'); }
        setBusy(false);
    }
    async function dismiss(s: Suggestion) { await supabase.from('work_activity').update({ dismissed: true }).in('id', s.activityIds); await reload(); }

    if (data === undefined) return null;
    if (data === null) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Automatický návrh výkazu zatím není v databázi zapnutý (chybí spuštění souboru stopa-prace.sql).</p>;
    const days = [...new Set(list.map((s) => s.day))];
    const selected = list.filter((s) => val(s).on).reduce((sum, s) => sum + (parseDuration(val(s).minutes) || 0), 0);
    return (
        <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5" aria-label="Návrh výkazu">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex flex-1 items-center gap-2 text-lg font-bold text-slate-900"><Sparkles size={18} className="text-indigo-700" aria-hidden="true" /> Návrh výkazu</h2>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Zaokrouhlit na<select value={unit} onChange={(e) => { const v = Number(e.target.value); setUnit(v); try { localStorage.setItem(UNIT_KEY, String(v)); } catch { /* ok */ } }} className={`${inputCls} w-auto py-1`}>{[5, 6, 10, 15, 30].map((u) => <option key={u} value={u}>{u} min</option>)}</select></label>
            </div>
            <p className="mt-1 text-sm text-slate-600">Kancelář sleduje, na čem jste v aplikaci pracovali (datové zprávy, e-maily, dokumenty, zápisy, komunikace s klientem), a navrhne výkaz. Čas je odhad, upravte ho a potvrďte. Bez potvrzení se nic nezapíše.</p>
            {list.length === 0 ? <p className="mt-3 text-sm text-slate-500">Za posledních {DAYS} dní nic nezapsaného. Jak budete pracovat s datovkami, e-maily a dokumenty, návrh se tu sám poskládá.</p> : (
                <div className="mt-4 space-y-4">
                    {days.map((d) => (
                        <div key={d}>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{dayLabel(d)}</p>
                            <ul className="mt-1.5 space-y-2">
                                {list.filter((s) => s.day === d).map((s) => { const v = val(s); return (
                                    <li key={s.key} className={`rounded-xl border bg-white p-3 ${v.on ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <input type="checkbox" checked={v.on} onChange={(e) => set(s.key, { off: !e.target.checked })} aria-label="Zapsat" className="h-4 w-4 accent-indigo-800" />
                                            {s.caseId ? <Link href={`/kancelar/veci/${s.caseId}`} className="min-w-0 flex-1 truncate font-semibold text-slate-900 hover:underline">{title(s.caseId)}</Link>
                                                : <select value={v.caseId} onChange={(e) => set(s.key, { caseId: e.target.value })} className={`${inputCls} w-auto min-w-0 flex-1 py-1`} aria-label="Věc"><option value="">Bez věci</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>}
                                            <input value={v.minutes} onChange={(e) => set(s.key, { minutes: e.target.value })} aria-label="Čas" className={`${inputCls} w-20 py-1 text-right font-semibold`} />
                                            <button type="button" onClick={() => void dismiss(s)} aria-label="Zahodit návrh" title="Zahodit návrh" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"><X size={15} /></button>
                                        </div>
                                        <input value={v.description} onChange={(e) => set(s.key, { description: e.target.value })} aria-label="Popis" className={`${inputCls} mt-2 py-1.5`} />
                                        <p className="mt-1 text-[11px] text-slate-400">{s.activityIds.length} úkonů, {new Date(s.from).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}–{new Date(s.to).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}{s.already ? ` · už zapsáno ${fmtMinutes(s.already)}` : ''} · odhad {fmtMinutes(s.rawMinutes)}</p>
                                    </li>); })}
                            </ul>
                        </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => void confirm()} disabled={busy || selected === 0} className={primaryBtn}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Zapsat vybrané ({fmtMinutes(selected)} h)</button>
                        {msg && <span role="status" className="text-sm text-slate-600">{msg}</span>}
                    </div>
                </div>
            )}
        </section>
    );
}

// Krátké upozornění na nástěnce: kolik práce za dnešek a včerejšek ještě není ve výkazu
export function WorkNudge() {
    const [minutes, setMinutes] = useState(0);
    useEffect(() => {
        let alive = true;
        loadData().then((d) => {
            if (!alive || !d) return;
            const recent = [pragueDay(new Date().toISOString()), pragueDay(new Date(Date.now() - 86_400_000).toISOString())];
            setMinutes(suggest(d.acts, d.logged, { unit: readUnit() }).filter((s) => recent.includes(s.day)).reduce((s, x) => s + x.minutes, 0));
        }).catch(() => undefined);
        return () => { alive = false; };
    }, []);
    if (minutes < 5) return null;
    return <Link href="/kancelar/vykazy" className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 hover:border-indigo-400"><Sparkles size={18} className="shrink-0 text-indigo-700" aria-hidden="true" /><span className="flex-1"><strong>{fmtMinutes(minutes)} h práce</strong> za dnešek a včerejšek ještě není ve výkazu. Návrh je připravený, stačí ho zkontrolovat.</span><span className="font-semibold">Zkontrolovat →</span></Link>;
}

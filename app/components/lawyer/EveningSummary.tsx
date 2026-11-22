'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Moon, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import type { LawyerClient } from '@/lib/lawyer';
import { fmtMinutes, pragueDay, suggest, type Activity } from '@/lib/workLog';
import { confirmSuggestions, daySummary } from '@/lib/workConfirm';
import { primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import { DEMO_MARK_LIKE } from '@/lib/demoMarks';

const UNIT_KEY = 'kancelar-vykaz-jednotka';
const readUnit = () => { try { const v = Number(localStorage.getItem(UNIT_KEY)); return [5, 6, 10, 15, 30].includes(v) ? v : 15; } catch { return 15; } };
const since = () => new Date(Date.now() - 14 * 86_400_000).toISOString();

// Souhrn dne na nástěnce: co jste dnes v aplikaci udělali, kolik to dělá času, a zápis do výkazu jedním klepnutím.
// Čas je odhad. Potvrzením vezmete odhad za svůj, každou položku jde předtím upravit ve Výkazech.
export default function EveningSummary() {
    const { userId, access } = useLawyer();
    const [data, setData] = useState<{ acts: Activity[]; logged: { case_id: string | null; entry_date: string; minutes: number }[]; cases: LegalCase[]; clients: LawyerClient[] } | null | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ n: number; total: number } | null>(null);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        const [a, t, cases, cl] = await Promise.all([
            supabase.from('work_activity').select('id, case_id, kind, label, words, at, time_entry_id, dismissed').gte('at', since()).order('at'),
            supabase.from('time_entries').select('case_id, entry_date, minutes').not('description', 'ilike', DEMO_MARK_LIKE).gte('entry_date', pragueDay(since())),
            loadCases().catch(() => [] as LegalCase[]),
            supabase.from('lawyer_clients').select('*'),
        ]);
        if (a.error) { setData(null); return; }
        setData({ acts: (a.data ?? []) as Activity[], logged: (t.data ?? []) as { case_id: string | null; entry_date: string; minutes: number }[], cases, clients: (cl.data ?? []) as LawyerClient[] });
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    const today = pragueDay(new Date().toISOString());
    const list = useMemo(() => (data ? suggest(data.acts, data.logged, { unit: readUnit() }) : []), [data]);
    const sum = useMemo(() => daySummary(list, today), [list, today]);
    const title = (id: string | null) => (id ? data?.cases.find((c) => c.id === id)?.title ?? 'Spis' : 'Bez spisu');
    const rateFor = (caseId: string) => {
        const c = data?.cases.find((x) => x.id === caseId);
        return data?.clients.find((x) => x.name.toLowerCase() === (c?.client_name ?? '').trim().toLowerCase())?.hourly_rate ?? access.default_rate ?? 0;
    };

    async function confirmAll() {
        setBusy(true); setError('');
        try { const r = await confirmSuggestions(userId, sum.today, {}, rateFor); setDone({ n: r.rows.length, total: r.total }); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Zápis se nepovedl.'); }
        setBusy(false);
    }

    if (data === undefined || data === null) return null;
    const evening = new Date().getHours() >= 15;
    if (done && sum.today.length === 0) {
        return <section role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><Check size={18} aria-hidden="true" /> Zapsáno {done.n} {done.n === 1 ? 'položka' : done.n < 5 ? 'položky' : 'položek'}, celkem {fmtMinutes(done.total)} h. <Link href="/kancelar/vykazy" className="font-semibold underline">Výkazy</Link></section>;
    }
    if (sum.minutes < 10 && sum.older.length === 0) return null;
    const olderMin = sum.older.reduce((s, x) => s + x.minutes, 0);
    return (
        <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5" aria-labelledby="ev-title">
            <div className="flex flex-wrap items-center gap-3">
                <h2 id="ev-title" className="flex flex-1 items-center gap-2 text-lg font-bold text-slate-900">{evening ? <Moon size={18} className="text-indigo-700" aria-hidden="true" /> : <Sparkles size={18} className="text-indigo-700" aria-hidden="true" />} {evening ? 'Konec dne: potvrďte dnešní práci' : 'Dnešní práce zatím'}</h2>
                {sum.today.length > 0 && <button type="button" onClick={() => void confirmAll()} disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapsat vše ({fmtMinutes(sum.minutes)} h)</button>}
            </div>
            {sum.today.length > 0 && (
                <>
                    <p className="mt-1 text-sm text-slate-600">Z toho, co jste dnes v aplikaci udělali, vychází {fmtMinutes(sum.minutes)} h na {sum.cases} {sum.cases === 1 ? 'spisu' : 'spisech'}. Čas je odhad: zkontrolujte ho nebo upravte ve Výkazech, než ho zapíšete.</p>
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                        {sum.today.slice(0, 5).map((s) => (
                            <li key={s.key} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{title(s.caseId)}</span><span className="block truncate text-xs text-slate-500">{s.description}</span></span>
                                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmtMinutes(s.minutes)}</span>
                            </li>
                        ))}
                        {sum.today.length > 5 && <li className="px-3 py-2 text-xs text-slate-500">a dalších {sum.today.length - 5} ve Výkazech</li>}
                    </ul>
                </>
            )}
            {sum.older.length > 0 && <p className="mt-3 text-sm text-slate-600">Z předchozích dnů ještě není zapsáno {fmtMinutes(olderMin)} h. <Link href="/kancelar/vykazy" className="font-semibold text-indigo-800 underline">Projít</Link></p>}
            {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
            <p className="mt-3 text-xs"><Link href="/kancelar/vykazy" className="font-semibold text-indigo-800 hover:underline">Upravit před zápisem →</Link></p>
        </section>
    );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/billing';
import { ACTION_LABEL, STATE_LABEL, archState, protocolCsv, type ArchState, type LogRow } from '@/lib/archive';
import { ghostBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';
import ArchiveCard from './ArchiveCard';

type Row = { id: string; title: string; status: string; user_id: string; archived_on: string | null; archive_until: string | null; archive_place: string; disposed_on: string | null; disposal: string | null; client_name?: string };
const dmy = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '');
const ORDER: ArchState[] = ['uplynulo', 'brzy', 'k-archivaci', 'archiv', 'vydano', 'skartovano'];
const TONE: Partial<Record<ArchState, string>> = { uplynulo: 'bg-rose-100 text-rose-900', brzy: 'bg-amber-100 text-amber-900', 'k-archivaci': 'bg-indigo-100 text-indigo-900' };

// Archiv spisů: uzavřené věci k archivaci, archiv s lhůtami uložení, vydané a skartované a protokol úkonů
export default function LawyerArchive() {
    const { userId } = useLawyer();
    const [rows, setRows] = useState<Row[] | null>(null);
    const [log, setLog] = useState<(LogRow & { id: string; case_id: string | null })[]>([]);
    const [missing, setMissing] = useState(false);
    const [filter, setFilter] = useState<ArchState | ''>('');
    const [open, setOpen] = useState<string | null>(null);
    const today = todayIso();

    const load = useCallback(async () => {
        const [c, l] = await Promise.all([
            supabase.from('cases').select('id, title, status, user_id, archived_on, archive_until, archive_place, disposed_on, disposal, client_name').eq('user_id', userId).eq('status', 'done'),
            supabase.from('case_archive_log').select('id, case_id, done_on, action, case_title, until_on, place, note').order('done_on', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
        ]);
        if (c.error) { if (/archived_on|schema cache|does not exist/i.test(c.error.message)) setMissing(true); setRows([]); return; }
        setRows((c.data ?? []) as Row[]); setLog((l.data ?? []) as typeof log);
    }, [userId]);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    const withState = useMemo(() => (rows ?? []).map((r) => ({ r, s: archState(r, today) })).sort((a, b) => ORDER.indexOf(a.s) - ORDER.indexOf(b.s) || (a.r.archive_until ?? '').localeCompare(b.r.archive_until ?? '')), [rows, today]);
    const counts = useMemo(() => { const m: Partial<Record<ArchState, number>> = {}; for (const x of withState) m[x.s] = (m[x.s] ?? 0) + 1; return m; }, [withState]);
    const shown = withState.filter((x) => !filter || x.s === filter);

    function csv() {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([protocolCsv(log)], { type: 'text/csv;charset=utf-8' })); a.download = 'protokol-archivu.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    if (rows === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (missing) return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Archiv se zapne po spuštění migrace 20261118_19 v Supabase.</p>;
    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Archiv spisů</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Uzavřený spis se archivuje s datem, místem uložení a lhůtou. Kancelář hlídá, kdy lhůta uplyne, a každý úkon (archivace, prodloužení, vydání, skartace) zapíše do protokolu, který nejde měnit. Délku uložení určujete vy podle stavovských předpisů.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setFilter('')} className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer ${!filter ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}`}>Vše ({withState.length})</button>
                    {ORDER.filter((s) => counts[s]).map((s) => <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer ${filter === s ? 'bg-indigo-700 text-white' : TONE[s] ?? 'bg-slate-100 text-slate-700'}`}>{STATE_LABEL[s]} ({counts[s]})</button>)}
                </div>
            </section>

            {shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Žádná uzavřený spis.</p> : (
                <ul className="space-y-2">
                    {shown.map(({ r, s }) => (
                        <li key={r.id} className="rounded-2xl border border-slate-200 bg-white">
                            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full flex-wrap items-center gap-3 p-3 text-left cursor-pointer">
                                <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{r.title}</span><span className="block text-xs text-slate-500">{[r.client_name, r.archived_on && `archivováno ${dmy(r.archived_on)}`, r.archive_place].filter(Boolean).join(' · ')}</span></span>
                                {r.archive_until && !r.disposal && <span className="text-xs text-slate-600">uložit do {dmy(r.archive_until)}</span>}
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[s] ?? 'bg-slate-100 text-slate-600'}`}>{STATE_LABEL[s]}</span>
                            </button>
                            {open === r.id && <div className="border-t border-slate-100 p-3"><ArchiveCard item={r} onChanged={load} /><Link href={`/kancelar/veci/${r.id}`} className="mt-2 inline-block text-xs font-semibold text-indigo-800 hover:underline">Otevřít spis</Link></div>}
                        </li>
                    ))}
                </ul>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Protokol">
                <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">Protokol úkonů ({log.length})</h3><button type="button" onClick={csv} disabled={!log.length} className={ghostBtn}><Download size={14} /> CSV</button></div>
                {log.length === 0 ? <p className="mt-2 text-sm text-slate-500">Zatím žádný úkon.</p> : (
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">{log.slice(0, 50).map((l) => <li key={l.id} className="flex flex-wrap gap-x-3 py-1.5"><span className="w-24 text-slate-500">{dmy(l.done_on)}</span><span className="w-36 font-semibold text-slate-800">{ACTION_LABEL[l.action]}</span><span className="min-w-0 flex-1 text-slate-700">{l.case_title}{l.until_on ? ` · do ${dmy(l.until_on)}` : ''}{l.place ? ` · ${l.place}` : ''}{l.note ? ` · ${l.note}` : ''}</span></li>)}</ul>
                )}
            </section>
        </div>
    );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Flag, Loader2, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { todayIso } from '@/lib/billing';
import { confirmAction } from '@/lib/confirm';
import { scheduleGoogleSync } from '@/lib/googleSync';
import type { TeamTask } from '@/lib/agenda';
import { createTask, loadColleagues, loadNames, loadTasks, type Colleague } from '@/lib/teamTasks';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Tab = 'pro-me' | 'zadane' | 'hotove';
const dmy = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
const left = (iso: string, today: string) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);

export function TaskForm({ colleagues, cases, me, initial, onDone }: { colleagues: Colleague[]; cases: LegalCase[]; me: string; initial?: { date?: string; assignee?: string }; onDone: () => void }) {
    const [f, setF] = useState({ assignee_id: initial?.assignee ?? (colleagues[0]?.user_id ?? me), title: '', note: '', due_date: initial?.date ?? todayIso(), due_time: '', priority: 'normal' as 'normal' | 'high', case_id: '' });
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    async function save() {
        if (!f.title.trim()) { setErr('Napište, co je potřeba udělat.'); return; }
        setBusy(true); setErr('');
        try { await createTask({ ...f, created_by: me }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
    }
    return (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:grid-cols-6" aria-label="Nový úkol">
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Pro koho<select value={f.assignee_id} onChange={(e) => setF({ ...f, assignee_id: e.target.value })} className={`${inputCls} mt-0.5 font-normal`}><option value={me}>Pro mě</option>{colleagues.filter((c) => c.user_id !== me).map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-4">Co udělat<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} placeholder="např. Připravit vyjádření k odporu" className={`${inputCls} mt-0.5 font-normal`} /></label>
            <label className="text-xs font-semibold text-slate-600">Do kdy<input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} /></label>
            <label className="text-xs font-semibold text-slate-600">V kolik (nepovinné)<input type="time" value={f.due_time} onChange={(e) => setF({ ...f, due_time: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} /></label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-3">Věc (nepovinné)<select value={f.case_id} onChange={(e) => setF({ ...f, case_id: e.target.value })} className={`${inputCls} mt-0.5 font-normal`}><option value="">Bez věci</option>{cases.filter((c) => c.status === 'open').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-800"><input type="checkbox" checked={f.priority === 'high'} onChange={(e) => setF({ ...f, priority: e.target.checked ? 'high' : 'normal' })} /> Spěchá</label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-6">Poznámka (nepovinné)<textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} maxLength={2000} className={`${inputCls} mt-0.5 font-normal`} /></label>
            {f.case_id && f.assignee_id !== me && <p className="text-xs text-slate-500 sm:col-span-6">Kolega uvidí název věci. Obsah věci jen tehdy, když mu ji sdílíte (ve věci tlačítko Sdílení).</p>}
            {err && <p role="alert" className="text-sm font-semibold text-rose-800 sm:col-span-6">{err}</p>}
            <div className="flex gap-2 sm:col-span-6"><button type="submit" disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {f.assignee_id === me ? 'Uložit úkol' : 'Zadat úkol'}</button><button type="button" onClick={onDone} className={ghostBtn}>Zrušit</button></div>
        </form>
    );
}

// Úkoly mezi kolegy: co mám udělat já, co jsem zadal ostatním, a hotové
export default function LawyerTeamTasks() {
    const { userId } = useLawyer();
    const [tasks, setTasks] = useState<TeamTask[] | null | undefined>(undefined);
    const [names, setNames] = useState<Record<string, string>>({});
    const [colleagues, setColleagues] = useState<Colleague[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [tab, setTab] = useState<Tab>('pro-me');
    const [form, setForm] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('novy') === '1');
    const [decline, setDecline] = useState<{ id: string; answer: string } | null>(null);
    const [err, setErr] = useState('');
    const today = todayIso();

    const load = useCallback(async () => {
        try {
            const [t, col, cs] = await Promise.all([loadTasks(), loadColleagues(), loadCases().catch(() => [] as LegalCase[])]);
            setTasks(t); setColleagues(col); setCases(cs);
            if (t) {
                setNames(await loadNames(t.flatMap((x) => [x.created_by, x.assignee_id])));
                // Úkoly pro mě, které vidím poprvé, se označí jako viděné (zadavatel to uvidí)
                const unseen = t.filter((x) => x.assignee_id === userId && !x.seen_at && x.created_by !== userId).map((x) => x.id);
                if (unseen.length) await supabase.from('team_tasks').update({ seen_at: new Date().toISOString() }).in('id', unseen);
            }
        } catch (e) { setErr(e instanceof Error ? e.message : 'Úkoly se nepodařilo načíst.'); setTasks([]); }
    }, [userId]);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    const lists = useMemo(() => {
        const all = tasks ?? [];
        return {
            'pro-me': all.filter((t) => t.assignee_id === userId && t.status === 'open'),
            zadane: all.filter((t) => t.created_by === userId && t.assignee_id !== userId && t.status !== 'done'),
            hotove: all.filter((t) => t.status === 'done').sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')).slice(0, 100),
        } satisfies Record<Tab, TeamTask[]>;
    }, [tasks, userId]);

    async function setStatus(t: TeamTask, status: TeamTask['status'], answer?: string) {
        setErr('');
        const { error } = await supabase.from('team_tasks').update({ status, ...(answer !== undefined ? { answer } : {}) }).eq('id', t.id);
        if (error) setErr(error.message); else { setDecline(null); scheduleGoogleSync(); await load(); }
    }
    async function remove(t: TeamTask) {
        if (!(await confirmAction(`Smazat úkol „${t.title}“?${t.assignee_id !== userId ? ` Zmizí i ${names[t.assignee_id] ?? 'kolegovi'}.` : ''}`))) return;
        const { error } = await supabase.from('team_tasks').delete().eq('id', t.id);
        if (error) setErr(error.message); else await load();
    }

    if (tasks === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (tasks === null) return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Úkoly pro kolegy se zapnou po spuštění migrace 20261118_21 v Supabase.</p>;
    const shown = lists[tab];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
                    {([['pro-me', 'Pro mě'], ['zadane', 'Zadal(a) jsem'], ['hotove', 'Hotové']] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer ${tab === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}>{l} ({lists[id].length})</button>)}
                </div>
                <Link href="/kancelar/kalendar" className={`${ghostBtn} ml-auto`}>Kalendář</Link>
                <button type="button" onClick={() => setForm(true)} className={primaryBtn}><Plus size={15} /> Zadat úkol</button>
            </div>
            {colleagues.length === 0 && <p className="text-sm text-slate-500">Nejste v kanceláři s kolegy, úkoly si můžete zadávat jen sami sobě. Kolegy přidáte v sekci Tým.</p>}
            {form && <TaskForm colleagues={colleagues} cases={cases} me={userId} onDone={() => { setForm(false); void load(); }} />}
            {err && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{err}</p>}
            {shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{tab === 'pro-me' ? 'Nemáte žádný otevřený úkol.' : tab === 'zadane' ? 'Nikomu jste nezadali úkol, který by čekal.' : 'Zatím nic hotového.'}</p> : (
                <ul className="space-y-2">
                    {shown.map((t) => {
                        const d = left(t.due_date, today); const mine = t.assignee_id === userId; const iCreated = t.created_by === userId;
                        return (
                            <li key={t.id} className={`rounded-2xl border bg-white p-4 ${t.status === 'open' && d < 0 ? 'border-rose-300' : t.priority === 'high' && t.status === 'open' ? 'border-amber-300' : 'border-slate-200'}`}>
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900">{t.priority === 'high' && <Flag size={13} className="mr-1 inline text-amber-600" aria-label="Spěchá" />}{t.title}</p>
                                        <p className="text-xs text-slate-500">{mine ? (iCreated ? 'můj úkol' : `zadal(a) ${names[t.created_by] ?? 'kolega'}`) : `pro ${names[t.assignee_id] ?? 'kolegu'}${t.seen_at ? ' · viděno' : ' · zatím neviděno'}`}{t.case_id ? <> · <Link href={`/kancelar/veci/${t.case_id}`} className="underline">{t.case_title || 'věc'}</Link></> : t.case_title ? ` · ${t.case_title}` : ''}</p>
                                        {t.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{t.note}</p>}
                                        {t.answer && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-700"><strong>Odpověď:</strong> {t.answer}</p>}
                                    </div>
                                    <span className={`whitespace-nowrap text-sm font-semibold ${t.status !== 'open' ? 'text-slate-500' : d < 0 ? 'text-rose-700' : d <= 1 ? 'text-amber-700' : 'text-slate-700'}`}>{t.status === 'done' ? `hotovo ${t.done_at ? new Date(t.done_at).toLocaleDateString('cs-CZ') : ''}` : t.status === 'declined' ? 'odmítnuto' : `${dmy(t.due_date)}${t.due_time ? ` ${t.due_time.slice(0, 5)}` : ''}`}{t.status === 'open' && d < 0 && <span className="block text-xs"><AlertTriangle size={11} className="mr-0.5 inline" aria-hidden="true" />po termínu</span>}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {t.status === 'open' && <button type="button" onClick={() => void setStatus(t, 'done')} className={primaryBtn}><Check size={14} /> Hotovo</button>}
                                    {t.status !== 'open' && <button type="button" onClick={() => void setStatus(t, 'open')} className={ghostBtn}><RotateCcw size={14} /> Vrátit do práce</button>}
                                    {mine && !iCreated && t.status === 'open' && <button type="button" onClick={() => setDecline({ id: t.id, answer: '' })} className={ghostBtn}><X size={14} /> Odmítnout</button>}
                                    {iCreated && <button type="button" onClick={() => void remove(t)} className={`${ghostBtn} text-rose-700`}><Trash2 size={14} /> Smazat</button>}
                                </div>
                                {decline?.id === t.id && (
                                    <form onSubmit={(e) => { e.preventDefault(); void setStatus(t, 'declined', decline.answer.trim()); }} className="mt-2 flex flex-wrap gap-2">
                                        <input value={decline.answer} onChange={(e) => setDecline({ ...decline, answer: e.target.value })} required minLength={2} maxLength={1000} placeholder="Proč (např. nestihnu, jsem u soudu)" aria-label="Důvod odmítnutí" className={`${inputCls} max-w-md flex-1`} />
                                        <button type="submit" className={primaryBtn}>Odmítnout</button>
                                    </form>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {lists.zadane.some((t) => t.status === 'declined') && tab !== 'zadane' && <p className="text-sm text-amber-900">Některý úkol, který jste zadali, kolega odmítl. Najdete ho v „Zadal(a) jsem“.</p>}
        </div>
    );
}

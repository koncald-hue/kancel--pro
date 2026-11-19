'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FolderPlus, ListTodo, Loader2, StickyNote, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BLANK_CASE, createCase, loadCases, type LegalCase } from '@/lib/cases';
import { insertRow } from '@/lib/caseFile';
import { applyDefaultTo } from '@/lib/templateApply';
import { partiesFromTitle } from '@/lib/conflicts';
import { todayIso } from '@/lib/billing';
import { shiftDays } from '@/lib/taskTemplates';
import { inputCls, primaryBtn } from '../situation/caseUi';
import ConflictPanel from './ConflictPanel';
import { useLawyer } from './LawyerGate';
import { createTask, loadColleagues, type Colleague } from '@/lib/teamTasks';

type Tab = 'cas' | 'ukol' | 'poznamka' | 'vec';
const TABS: [Tab, string, typeof Clock][] = [['cas', 'Čas', Clock], ['ukol', 'Úkol', ListTodo], ['poznamka', 'Poznámka', StickyNote], ['vec', 'Nová věc', FolderPlus]];
const MINUTES = [6, 15, 30, 60, 90];
const RECENT_KEY = 'kancelar-posledni-vec';

// Rychlé zadání odkudkoli: čas, úkol, poznámka do věci nebo nová věc, bez přecházení na jinou stránku
export default function QuickAdd({ open, onClose, initial = 'cas' }: { open: boolean; onClose: () => void; initial?: Tab }) {
    const { userId, access } = useLawyer();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>(initial);
    const [cases, setCases] = useState<LegalCase[] | null>(null);
    const [caseId, setCaseId] = useState('');
    const [minutes, setMinutes] = useState(15); const [desc, setDesc] = useState(''); const [date, setDate] = useState(todayIso());
    const [title, setTitle] = useState(''); const [due, setDue] = useState(shiftDays(todayIso(), 1, true));
    const [note, setNote] = useState('');
    // Komu je úkol (prázdné = já, úkol do věci); kolegové z kanceláře
    const [assignee, setAssignee] = useState('');
    const [colleagues, setColleagues] = useState<Colleague[]>([]);
    useEffect(() => { if (!open) return; let a = true; loadColleagues().then((c) => { if (a) setColleagues(c.filter((x) => x.user_id !== userId)); }); return () => { a = false; }; }, [open, userId]);
    const [busy, setBusy] = useState(false); const [done, setDone] = useState(''); const [err, setErr] = useState('');
    const first = useRef<HTMLSelectElement | HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open) return;
        let a = true;
        const t = window.setTimeout(() => { setTab(initial); setDone(''); setErr(''); }, 0);
        loadCases().then((c) => {
            if (!a) return;
            const openCases = c.filter((x) => x.status === 'open');
            setCases(openCases);
            let last = ''; try { last = localStorage.getItem(RECENT_KEY) ?? ''; } catch { /* nic */ }
            // Věc z adresy (jsem právě ve věci) má přednost, pak naposledy použitá
            const here = window.location.pathname.match(/\/kancelar\/veci\/([0-9a-f-]{36})/)?.[1] ?? '';
            setCaseId((cur) => cur || [here, last].find((id) => id && openCases.some((x) => x.id === id)) || (openCases.length === 1 ? openCases[0].id : ''));
        }).catch(() => { if (a) setCases([]); });
        return () => { a = false; window.clearTimeout(t); };
    }, [open, initial]);
    useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [open, onClose]);
    useEffect(() => { if (open) window.setTimeout(() => first.current?.focus(), 30); }, [open, tab]);

    const chosen = useMemo(() => cases?.find((c) => c.id === caseId) ?? null, [cases, caseId]);
    if (!open) return null;

    function remember(id: string) { try { localStorage.setItem(RECENT_KEY, id); } catch { /* nic */ } }
    async function rateFor(id: string): Promise<number> {
        const last = await supabase.from('time_entries').select('rate').eq('case_id', id).order('created_at', { ascending: false }).limit(1);
        const r = Number((last.data?.[0] as { rate?: number } | undefined)?.rate ?? 0);
        return r > 0 ? r : access.default_rate || 0;
    }
    async function run(fn: () => Promise<string>) {
        setBusy(true); setErr(''); setDone('');
        try { setDone(await fn()); } catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se uložit.'); } finally { setBusy(false); }
    }
    const saveTime = () => run(async () => {
        if (!caseId) throw new Error('Vyberte věc.');
        if (!desc.trim()) throw new Error('Napište, co jste dělali.');
        const rate = await rateFor(caseId);
        const { error } = await supabase.from('time_entries').insert({ case_id: caseId, user_id: userId, entry_date: date, minutes, rate, description: desc.trim().slice(0, 500) });
        if (error) throw new Error(error.message);
        remember(caseId); setDesc('');
        return `Zapsáno ${minutes} min${rate ? '' : ' (sazbu doplňte ve výkazech)'}.`;
    });
    const saveTask = () => run(async () => {
        if (!title.trim()) throw new Error('Napište, co je potřeba udělat.');
        // Úkol pro kolegu: jde do jeho Úkolů a kalendáře; věc je nepovinná
        if (assignee && assignee !== userId) {
            await createTask({ created_by: userId, assignee_id: assignee, title, due_date: due, case_id: caseId || null });
            if (caseId) remember(caseId); setTitle('');
            return `Úkol zadán: ${colleagues.find((c) => c.user_id === assignee)?.name ?? 'kolega'} ho uvidí ve svých úkolech a kalendáři.`;
        }
        if (!caseId) throw new Error('Vyberte věc.');
        await insertRow('case_deadlines', { case_id: caseId, user_id: userId, title: title.trim().slice(0, 200), due_date: due, kind: 'ukol' });
        remember(caseId); setTitle('');
        return `Úkol přidán na ${new Date(`${due}T12:00:00`).toLocaleDateString('cs-CZ')}.`;
    });
    const saveNote = () => run(async () => {
        if (!caseId) throw new Error('Vyberte věc.');
        if (!note.trim()) throw new Error('Napište poznámku.');
        await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'note', title: note.trim().split('\n')[0].slice(0, 120), body: note.trim().slice(0, 4000), happened_on: todayIso() });
        remember(caseId); setNote('');
        return 'Poznámka je v chronologii věci.';
    });
    const saveCase = () => run(async () => {
        if (!title.trim()) throw new Error('Napište název věci.');
        const created = await createCase(userId, { ...BLANK_CASE, title: title.trim().slice(0, 100) });
        const n = await applyDefaultTo(created.id, userId).catch(() => 0);
        remember(created.id); setTitle(''); onClose();
        router.push(`/kancelar/veci/${created.id}`);
        return n ? `Věc založena s ${n} úkoly ze šablony.` : 'Věc založena.';
    });

    const chips = (vals: [string, string][], cur: string, set: (v: string) => void) => (
        <div className="flex flex-wrap gap-1.5">{vals.map(([v, l]) => <button key={v} type="button" onClick={() => set(v)} className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${cur === v ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300'}`}>{l}</button>)}</div>
    );
    const caseSelect = (
        <label className="block text-xs font-semibold text-slate-600">Věc
            <select ref={(el) => { if (tab !== 'vec') first.current = el; }} value={caseId} onChange={(e) => setCaseId(e.target.value)} className={`${inputCls} mt-1 font-normal`}>
                <option value="">{cases === null ? 'Načítám věci…' : 'Vyberte věc…'}</option>
                {(cases ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}
            </select>
        </label>
    );
    const sides = tab === 'vec' ? partiesFromTitle(title) : [];
    const today = todayIso();

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Rychle zapsat" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">Rychle zapsat</h2>
                    <button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
                    {TABS.map(([id, l, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setDone(''); setErr(''); }} className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-semibold cursor-pointer sm:flex-row sm:justify-center sm:gap-1.5 ${tab === id ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}><Icon size={15} aria-hidden="true" />{l}</button>)}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); void (tab === 'cas' ? saveTime() : tab === 'ukol' ? saveTask() : tab === 'poznamka' ? saveNote() : saveCase()); }} className="mt-4 space-y-3">
                    {tab !== 'vec' && caseSelect}
                    {tab === 'cas' && (
                        <>
                            <div><p className="mb-1 text-xs font-semibold text-slate-600">Kolik</p>{chips(MINUTES.map((m) => [String(m), m < 60 ? `${m} min` : `${m / 60} h`.replace('.', ',')]), String(minutes), (v) => setMinutes(Number(v)))}
                                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">nebo <input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))} aria-label="Minuty" className={`${inputCls} w-24 py-1`} /> min</label></div>
                            <label className="block text-xs font-semibold text-slate-600">Co jste dělali<input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} placeholder="např. telefonát s klientem, příprava žaloby" className={`${inputCls} mt-1 font-normal`} /></label>
                            <label className="block text-xs font-semibold text-slate-600">Datum<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={`${inputCls} mt-1 w-auto font-normal`} /></label>
                        </>
                    )}
                    {tab === 'ukol' && (
                        <>
                            {colleagues.length > 0 && <label className="block text-xs font-semibold text-slate-600">Pro koho<select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${inputCls} mt-1 font-normal`}><option value="">Pro mě (úkol ve věci)</option>{colleagues.map((c) => <option key={c.user_id} value={c.user_id}>Pro kolegu: {c.name}</option>)}</select></label>}
                            <label className="block text-xs font-semibold text-slate-600">Co udělat<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="např. Zavolat klientovi kvůli podkladům" className={`${inputCls} mt-1 font-normal`} /></label>
                            <div><p className="mb-1 text-xs font-semibold text-slate-600">Do kdy</p>{chips([[shiftDays(today, 1, true), 'Další pracovní den'], [shiftDays(today, 3, true), 'Za 3 prac. dny'], [shiftDays(today, 7, false), 'Za týden'], [shiftDays(today, 14, false), 'Za 14 dní']], due, setDue)}
                                <input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} aria-label="Termín" className={`${inputCls} mt-2 w-auto`} /></div>
                        </>
                    )}
                    {tab === 'poznamka' && <label className="block text-xs font-semibold text-slate-600">Poznámka do chronologie<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} maxLength={4000} placeholder="První řádek bude nadpis záznamu." className={`${inputCls} mt-1 font-normal`} /></label>}
                    {tab === 'vec' && (
                        <>
                            <label className="block text-xs font-semibold text-slate-600">Název věci<input ref={(el) => { if (tab === 'vec') first.current = el; }} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="např. Novák proti Dvořákovi" className={`${inputCls} mt-1 font-normal`} /></label>
                            {sides.length === 2 && <div className="space-y-2"><ConflictPanel parties={[{ name: sides[1] }]} role="protistrana" compact /><ConflictPanel parties={[{ name: sides[0] }]} role="klient" compact /></div>}
                            <p className="text-xs text-slate-500">Věc dostane úkoly z výchozí šablony (máte-li ji) a otevře se.</p>
                        </>
                    )}
                    {chosen && tab !== 'vec' && <p className="text-xs text-slate-500">Ukládá se do věci „{chosen.title}“.</p>}
                    {err && <p role="alert" className="text-sm font-semibold text-rose-800">{err}</p>}
                    {done && <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><CheckCircle2 size={15} aria-hidden="true" /> {done}</p>}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="hidden text-xs text-slate-400 sm:inline">Otevřete kdykoli klávesou N, zavřete Esc.</span>
                        <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 size={14} className="animate-spin" />} {tab === 'vec' ? 'Založit věc' : 'Uložit'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

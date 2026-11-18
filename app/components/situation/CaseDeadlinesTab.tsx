'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Calculator, CalendarPlus, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { buildIcs, collectDeadlines, deleteRow, downloadTextFile, insertRow, updateRow, type CaseDeadline } from '@/lib/caseFile';
import { daysUntil } from '@/lib/cases';
import DeadlineAxis from './DeadlineAxis';
import DeadlineDialog, { type DeadlineTarget } from './DeadlineDialog';
import { scheduleGoogleSync } from '@/lib/googleSync';
import { applyTemplate, loadTemplates } from '@/lib/templateApply';
import type { CaseTemplate } from '@/lib/taskTemplates';
import { loadAllDeadlines } from '@/lib/caseFile';
import { daysWord, ghostBtn, inputCls, primaryBtn, type TabProps } from './caseUi';

export function deadlineTone(left: number, done: boolean) {
    if (done) return 'text-slate-400';
    if (left < 0) return 'text-slate-500';
    if (left <= 3) return 'text-rose-700';
    if (left <= 10) return 'text-indigo-800';
    return 'text-emerald-700';
}

export const deadlineText = (left: number) => (left < 0 ? `před ${-left} ${daysWord(-left)}` : left === 0 ? 'dnes' : `za ${left} ${daysWord(left)}`);

export default function CaseDeadlinesTab({ item, bundle, userId, patchItem, setBundle, fail }: TabProps) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [dialog, setDialog] = useState<DeadlineTarget | null>(null);
    const [templates, setTemplates] = useState<CaseTemplate[]>([]);
    const [tplNote, setTplNote] = useState('');
    useEffect(() => { loadTemplates().then(setTemplates).catch(() => undefined); }, []);
    async function runTemplate(id: string) {
        const tpl = templates.find((t) => t.id === id); if (!tpl) return;
        try {
            const r = await applyTemplate(tpl, item.id, userId, item.event_date);
            const all = await loadAllDeadlines(); setBundle((b) => ({ ...b, deadlines: all.filter((d) => d.case_id === item.id) }));
            setTplNote(`Přidáno úkolů: ${r.created}.${r.skipped.length ? ` Přeskočeno (chybí datum události): ${r.skipped.join(', ')}.` : ''}`);
        } catch (err) { fail(err); }
    }
    const list = collectDeadlines(item, bundle.deadlines);
    const hasLaw = item.deadline_ids.length > 0;

    async function add() {
        if (!title.trim() || !date) return;
        try {
            const base = { case_id: item.id, user_id: userId, title: title.trim().slice(0, 120), due_date: date };
            // Rychlé přidání je úkol / termín; lhůtu s potvrzením data přidáte přes „Přidat úkol nebo lhůtu“.
            // Bez migrace 20261117_01 sloupec kind neexistuje, pak se uloží jako dřív.
            const row = await insertRow<CaseDeadline>('case_deadlines', { ...base, kind: 'ukol' }).catch(() => insertRow<CaseDeadline>('case_deadlines', base));
            setBundle((b) => ({ ...b, deadlines: [...b.deadlines, row] }));
            setTitle(''); setDate('');
            scheduleGoogleSync();
        } catch (err) { fail(err); }
    }

    async function toggle(id: string, done: boolean) {
        try {
            await updateRow('case_deadlines', id, { done });
            setBundle((b) => ({ ...b, deadlines: b.deadlines.map((d) => (d.id === id ? { ...d, done } : d)) }));
            scheduleGoogleSync();
        } catch (err) { fail(err); }
    }

    async function remove(id: string) {
        try { await deleteRow('case_deadlines', id); setBundle((b) => ({ ...b, deadlines: b.deadlines.filter((d) => d.id !== id) })); scheduleGoogleSync(); } catch (err) { fail(err); }
    }

    function exportIcs() {
        const open = list.filter((d) => !d.done && daysUntil(d.date) >= 0);
        if (!open.length) { fail(new Error('Nejsou žádné nadcházející lhůty k exportu.')); return; }
        downloadTextFile('lhuty-spis.ics', buildIcs(item.title, open.map((d) => ({ uid: `${item.id}-${d.key}`, title: d.title, iso: d.iso }))), 'text/calendar');
    }

    return (
        <div className="space-y-5">
            {hasLaw && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
                    <label className="block text-sm font-semibold text-slate-900">Datum události / doručení dokumentu
                        <input type="date" value={item.event_date ?? ''} onChange={(e) => { patchItem({ event_date: e.target.value || null }); scheduleGoogleSync(); }} className={`${inputCls} mt-1.5 max-w-52`} />
                    </label>
                    <p className="mt-1.5 text-xs text-slate-600">Podle něj aplikace orientačně spočítá zákonné lhůty včetně posunu na pracovní den. Výsledek je třeba ověřit.</p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Všechny lhůty, úkoly a termíny</p>
                <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setDialog({ caseId: item.id, caseTitle: item.title })} className={primaryBtn}><Plus size={15} /> Přidat úkol nebo lhůtu</button>
                    {templates.length > 0 && <select value="" onChange={(e) => void runTemplate(e.target.value)} aria-label="Použít šablonu úkolů" className={`${inputCls} w-auto`}><option value="">Použít šablonu…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                    <button type="button" onClick={exportIcs} className={ghostBtn}><CalendarPlus size={15} /> Přidat do kalendáře (.ics)</button>
                </span>
            </div>

            {tplNote && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">{tplNote}</p>}
            {list.some((d) => !d.done) && <DeadlineAxis deadlines={list} />}

            {list.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{hasLaw ? 'Zadejte datum události a lhůty se spočítají.' : 'Zatím žádné lhůty. Přidejte vlastní termín níže.'}</p>
            ) : (
                <ul className="space-y-2">
                    {list.map((d) => {
                        const left = daysUntil(d.date);
                        return (
                            <li key={d.key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                                {d.source === 'custom' ? (
                                    <button type="button" onClick={() => void toggle(d.customId!, !d.done)} aria-label={d.done ? 'Označit jako nesplněné' : 'Označit jako splněné'} aria-pressed={d.done} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border cursor-pointer ${d.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>{d.done && <Check size={14} />}</button>
                                ) : <Calculator size={20} className="shrink-0 text-amber-600" aria-label="Vypočteno orientačně" />}
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold ${d.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{d.title}</p>
                                    {d.basis && <details className="mt-0.5 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-indigo-800">Z datové zprávy: jak vznikla{d.internal ? ` · podat nejpozději ${new Date(`${d.internal}T12:00:00`).toLocaleDateString('cs-CZ')}` : ''}</summary><p className="mt-1 leading-relaxed">{d.basis}</p>{d.quote && <blockquote className="mt-1 border-l-2 border-indigo-300 pl-2 italic">{d.quote}</blockquote>}</details>}
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                        {d.source === 'law' ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">Zákonná lhůta · vypočteno orientačně, neověřeno</span>
                                            : d.kind === 'ukol' ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">Úkol / termín</span>
                                                : d.confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800" title={d.confirmedAt ? `Potvrzeno ${new Date(d.confirmedAt).toLocaleString('cs-CZ')}` : undefined}><BadgeCheck size={11} aria-hidden="true" /> Lhůta · datum potvrzeno advokátem</span>
                                                    : <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">Lhůta · datum nepotvrzeno</span>}
                                        <span>{d.date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    </p>
                                </div>
                                <span className={`shrink-0 text-right text-xs font-bold ${deadlineTone(left, d.done)}`}>{d.done ? 'splněno' : deadlineText(left)}</span>
                                {!d.done && (d.source === 'law' || (d.kind === 'lhuta' && !d.confirmed)
                                    ? <button type="button" onClick={() => setDialog({ caseId: item.id, caseTitle: item.title, source: d.source, customId: d.customId, lawKey: d.lawKey, title: d.title, iso: d.iso, kind: d.kind, confirmed: d.confirmed, assigneeId: d.assigneeId })} className="shrink-0 rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600 cursor-pointer">Ověřit datum</button>
                                    : d.source === 'custom' && <button type="button" onClick={() => setDialog({ caseId: item.id, caseTitle: item.title, source: 'custom', customId: d.customId, title: d.title, iso: d.iso, kind: d.kind, confirmed: d.confirmed, assigneeId: d.assigneeId })} aria-label={`Upravit ${d.title}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"><Pencil size={15} /></button>)}
                                {d.source === 'custom' && <button type="button" onClick={() => void remove(d.customId!)} aria-label={`Smazat ${d.title}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>}
                            </li>
                        );
                    })}
                </ul>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto]">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rychle přidat úkol nebo termín (jednání, schůzka…)" maxLength={120} className={inputCls} aria-label="Název úkolu nebo termínu" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Datum termínu" />
                <button type="submit" disabled={!title.trim() || !date} className={primaryBtn}>Přidat</button>
            </form>
            {dialog && <DeadlineDialog target={dialog} userId={userId} onClose={() => setDialog(null)} onSaved={(row) => { setBundle((b) => ({ ...b, deadlines: [...b.deadlines.filter((x) => x.id !== row.id), row] })); setDialog(null); scheduleGoogleSync(); }} />}
            <p className="text-xs text-slate-500">Vypočtené lhůty jsou orientační: aplikace nezná okolnosti doručení ani zvláštní úpravu. Než se na datum spolehnete, ověřte ho tlačítkem „Ověřit datum“.</p>
            <p className="text-xs text-slate-500">Tip: exportovaný kalendář obsahuje upozornění 3 dny a 1 den předem. Po nahrání do kalendáře v telefonu vám lhůty připomene i bez e-mailu.</p>
        </div>
    );
}

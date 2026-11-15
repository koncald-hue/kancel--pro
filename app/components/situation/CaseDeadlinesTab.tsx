'use client';

import { useState } from 'react';
import { CalendarDays, CalendarPlus, Check, Trash2 } from 'lucide-react';
import { buildIcs, collectDeadlines, deleteRow, downloadTextFile, insertRow, updateRow, type CaseDeadline } from '@/lib/caseFile';
import { daysUntil } from '@/lib/cases';
import DeadlineAxis from './DeadlineAxis';
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
    const list = collectDeadlines(item, bundle.deadlines);
    const hasLaw = item.deadline_ids.length > 0;

    async function add() {
        if (!title.trim() || !date) return;
        try {
            const row = await insertRow<CaseDeadline>('case_deadlines', { case_id: item.id, user_id: userId, title: title.trim().slice(0, 120), due_date: date });
            setBundle((b) => ({ ...b, deadlines: [...b.deadlines, row] }));
            setTitle(''); setDate('');
        } catch (err) { fail(err); }
    }

    async function toggle(id: string, done: boolean) {
        try {
            await updateRow('case_deadlines', id, { done });
            setBundle((b) => ({ ...b, deadlines: b.deadlines.map((d) => (d.id === id ? { ...d, done } : d)) }));
        } catch (err) { fail(err); }
    }

    async function remove(id: string) {
        try { await deleteRow('case_deadlines', id); setBundle((b) => ({ ...b, deadlines: b.deadlines.filter((d) => d.id !== id) })); } catch (err) { fail(err); }
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
                        <input type="date" value={item.event_date ?? ''} onChange={(e) => patchItem({ event_date: e.target.value || null })} className={`${inputCls} mt-1.5 max-w-52`} />
                    </label>
                    <p className="mt-1.5 text-xs text-slate-600">Podle něj se spočítají zákonné lhůty včetně posunu na pracovní den.</p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Všechny lhůty a termíny</p>
                <button type="button" onClick={exportIcs} className={ghostBtn}><CalendarPlus size={15} /> Přidat do kalendáře (.ics)</button>
            </div>

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
                                ) : <CalendarDays size={20} className="shrink-0 text-indigo-800" />}
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold ${d.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{d.title}</p>
                                    <p className="text-xs text-slate-500">{d.source === 'law' ? 'Zákonná lhůta' : 'Vlastní termín'} · {d.date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <span className={`shrink-0 text-right text-xs font-bold ${deadlineTone(left, d.done)}`}>{d.done ? 'splněno' : deadlineText(left)}</span>
                                {d.source === 'custom' && <button type="button" onClick={() => void remove(d.customId!)} aria-label={`Smazat ${d.title}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>}
                            </li>
                        );
                    })}
                </ul>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto]">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vlastní termín (jednání, splatnost, schůzka…)" maxLength={120} className={inputCls} aria-label="Název termínu" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Datum termínu" />
                <button type="submit" disabled={!title.trim() || !date} className={primaryBtn}>Přidat</button>
            </form>
            <p className="text-xs text-slate-500">Tip: exportovaný kalendář obsahuje upozornění 3 dny a 1 den předem. Po nahrání do kalendáře v telefonu vám lhůty připomene i bez e-mailu.</p>
        </div>
    );
}

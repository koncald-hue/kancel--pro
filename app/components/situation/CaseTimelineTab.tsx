'use client';

import { confirmAction } from '@/lib/confirm';
import { useState } from 'react';
import { Pin, PinOff, StickyNote, Trash2, Flag } from 'lucide-react';
import { deleteRow, insertRow, updateRow, type CaseEntry } from '@/lib/caseFile';
import { inputCls, primaryBtn, shortDate, type TabProps } from './caseUi';

const dayOf = (e: CaseEntry) => e.happened_on ?? e.created_at.slice(0, 10);

// Chronologie (co se kdy stalo) a poznámky v jednom proudu
export default function CaseTimelineTab({ item, bundle, userId, setBundle, fail }: TabProps) {
    const [kind, setKind] = useState<'event' | 'note'>('event');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [date, setDate] = useState('');
    const [query, setQuery] = useState('');

    async function add() {
        if (!title.trim()) return;
        try {
            const row = await insertRow<CaseEntry>('case_entries', { case_id: item.id, user_id: userId, kind, title: title.trim().slice(0, 140), body: body.trim().slice(0, 4000), happened_on: kind === 'event' ? date || new Date().toISOString().slice(0, 10) : null });
            setBundle((b) => ({ ...b, entries: [row, ...b.entries] }));
            setTitle(''); setBody(''); setDate('');
        } catch (err) { fail(err); }
    }

    async function pin(entry: CaseEntry) {
        try {
            await updateRow('case_entries', entry.id, { pinned: !entry.pinned });
            setBundle((b) => ({ ...b, entries: b.entries.map((e) => (e.id === entry.id ? { ...e, pinned: !e.pinned } : e)) }));
        } catch (err) { fail(err); }
    }

    async function remove(id: string) {
        if (!(await confirmAction('Smazat záznam z chronologie?'))) return;
        try { await deleteRow('case_entries', id); setBundle((b) => ({ ...b, entries: b.entries.filter((e) => e.id !== id) })); } catch (err) { fail(err); }
    }

    const q = query.trim().toLowerCase();
    const entries = bundle.entries
        .filter((e) => !q || `${e.title} ${e.body}`.toLowerCase().includes(q))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || dayOf(b).localeCompare(dayOf(a)) || b.created_at.localeCompare(a.created_at));

    return (
        <div className="space-y-5">
            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Druh záznamu">
                    {([['event', 'Událost v čase'], ['note', 'Poznámka']] as const).map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${kind === value ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>
                    ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'event' ? 'Co se stalo (např. Doručen trestní příkaz)' : 'Nadpis poznámky'} maxLength={140} className={inputCls} aria-label="Nadpis" />
                    {kind === 'event' && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Datum události" />}
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} placeholder="Podrobnosti (nepovinné)" className={inputCls} aria-label="Podrobnosti" />
                <button type="submit" disabled={!title.trim()} className={primaryBtn}>Přidat do spisu</button>
            </form>

            {bundle.entries.length > 4 && <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat v chronologii a poznámkách…" className={inputCls} aria-label="Hledat v záznamech" />}

            {entries.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{bundle.entries.length ? 'Nic nenalezeno.' : 'Zatím prázdno. Zapisujte, co se kdy stalo, a poznámky, ať na nic nezapomenete.'}</p>
            ) : (
                <ol className="relative space-y-3 border-l-2 border-indigo-200 pl-5">
                    {entries.map((e) => (
                        <li key={e.id} className="relative rounded-xl border border-slate-200 bg-white p-3.5">
                            <span className="absolute -left-[1.78rem] top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 border-indigo-300 bg-white" aria-hidden="true" />
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        {e.kind === 'event' ? <Flag size={12} className="text-indigo-700" /> : <StickyNote size={12} className="text-slate-500" />}
                                        {e.kind === 'event' ? shortDate(new Date(`${dayOf(e)}T12:00:00`)) : 'Poznámka'}
                                        {e.pinned && <span className="text-indigo-700">· připnuto</span>}
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{e.title}</p>
                                </div>
                                <div className="flex shrink-0">
                                    <button type="button" onClick={() => void pin(e)} aria-label={e.pinned ? 'Odepnout' : 'Připnout nahoru'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">{e.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
                                    <button type="button" onClick={() => void remove(e.id)} aria-label={`Smazat ${e.title}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
                                </div>
                            </div>
                            {e.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{e.body}</p>}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

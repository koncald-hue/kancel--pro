'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Gavel, Lightbulb, Plus, X } from 'lucide-react';
import { OFFENSES_DATABASE } from '@/app/data/offenses';
import { getOffenseUrl } from '@/lib/slug';
import { PUBLIC_SITE } from '@/lib/publicSite';
import { collectDeadlines, insertRow, type CaseEntry } from '@/lib/caseFile';
import { daysUntil } from '@/lib/cases';
import { inputCls, ghostBtn, type TabProps } from './caseUi';

// Chytré rady podle toho, co ve spisu chybí
export function caseHints(item: TabProps['item'], bundle: TabProps['bundle']): { tone: 'warn' | 'tip'; text: string }[] {
    const hints: { tone: 'warn' | 'tip'; text: string }[] = [];
    const deadlines = collectDeadlines(item, bundle.deadlines).filter((d) => !d.done);
    const overdue = deadlines.filter((d) => daysUntil(d.date) < 0);
    const soon = deadlines.filter((d) => { const l = daysUntil(d.date); return l >= 0 && l <= 3; });
    if (soon.length) hints.push({ tone: 'warn', text: `Lhůta „${soon[0].title}“ končí do 3 dnů. Zvažte, co ještě stihnout dnes.` });
    if (overdue.length) hints.push({ tone: 'warn', text: `Lhůta „${overdue[0].title}“ už skončila. Zkontrolujte, zda je splněná, a případně označte.` });
    if (item.deadline_ids.length > 0 && !item.event_date) hints.push({ tone: 'warn', text: 'Zadejte datum události v záložce Lhůty, jinak se zákonné lhůty nespočítají.' });
    if (bundle.files.length === 0) hints.push({ tone: 'tip', text: 'Nahrajte do spisu doručený dokument nebo jeho fotku, ať je vše na jednom místě.' });
    if (bundle.entries.filter((e) => e.kind === 'event').length === 0) hints.push({ tone: 'tip', text: 'Zapište do chronologie první událost, třeba kdy vám došlo oznámení.' });
    if (bundle.contacts.length === 0) hints.push({ tone: 'tip', text: 'Přidejte kontakt na úřad nebo soud, který věc vyřizuje.' });
    if (item.steps.length > 0 && item.steps.every((s) => s.done) && item.status === 'open') hints.push({ tone: 'tip', text: 'Všechny kroky jsou hotové. Můžete případ označit jako vyřešený.' });
    return hints;
}

export default function CaseOverviewTab({ item, bundle, userId, lawyer, patchItem, setBundle, fail }: TabProps) {
    const [step, setStep] = useState('');
    const [quick, setQuick] = useState('');
    const done = item.steps.filter((s) => s.done).length;
    const percent = item.steps.length ? Math.round((done / item.steps.length) * 100) : 0;
    const hints = caseHints(item, bundle);
    const offenses = item.offense_ids.flatMap((id) => OFFENSES_DATABASE.find((o) => o.id === id) ?? []);

    async function quickNote() {
        if (!quick.trim()) return;
        try {
            const row = await insertRow<CaseEntry>('case_entries', { case_id: item.id, user_id: userId, kind: 'note', title: quick.trim().slice(0, 140), body: '' });
            setBundle((b) => ({ ...b, entries: [row, ...b.entries] }));
            setQuick('');
        } catch (err) { fail(err); }
    }

    return (
        <div className="space-y-6">
            {hints.length > 0 && (
                <section aria-label="Doporučení pro spis" className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
                    <p className="text-sm font-bold text-slate-900">Co by stálo za doplnění</p>
                    <ul className="mt-2 space-y-2">
                        {hints.map((h) => (
                            <li key={h.text} className={`flex items-start gap-2 text-sm ${h.tone === 'warn' ? 'font-semibold text-rose-800' : 'text-slate-700'}`}>
                                {h.tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Lightbulb size={16} className="mt-0.5 shrink-0 text-indigo-700" />}
                                {h.text}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {lawyer && <section aria-label="Údaje o věci" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-900">Údaje o věci</h3>
                <p className="text-xs text-slate-500">Uvedou se na titulní straně předávaného spisu. Hodí se pro úřady i advokáty.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {([['reference', 'Spisová značka / č. j.', 'např. 12 T 34/2026'], ['authority', 'Úřad nebo soud', 'např. Městský úřad Plzeň'], ['client_name', 'Klient / dotčená osoba', 'např. Jan Novák']] as const).map(([key, label, placeholder]) => (
                        <label key={key} className="block text-xs font-semibold text-slate-600">{label}
                            <input defaultValue={item[key] ?? ''} key={`${item.id}-${key}`} maxLength={120} placeholder={placeholder} onBlur={(e) => { const value = e.target.value.trim(); if (value !== (item[key] ?? '')) patchItem({ [key]: value }); }} className={`${inputCls} mt-1 font-normal`} />
                        </label>
                    ))}
                </div>
            </section>}

            {item.summary && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-900">Shrnutí situace</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.summary}</p>
                </section>
            )}

            <section>
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Postup</h3>
                    <span className="text-xs text-slate-500">{done} z {item.steps.length} hotovo</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Postup kroků">
                    <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <ul className="mt-3 space-y-2">
                    {item.steps.map((s, index) => (
                        <li key={index} className="group flex items-start gap-2.5">
                            <input type="checkbox" id={`step-${index}`} checked={s.done} onChange={() => patchItem({ steps: item.steps.map((x, i) => (i === index ? { ...x, done: !x.done } : x)) })} className="mt-1 h-4 w-4 accent-indigo-800" />
                            <label htmlFor={`step-${index}`} className={`flex-1 cursor-pointer text-sm ${s.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{s.text}</label>
                            <button type="button" onClick={() => patchItem({ steps: item.steps.filter((_, i) => i !== index) })} aria-label={`Odebrat krok ${s.text}`} className="rounded p-1 text-slate-400 hover:text-rose-700 cursor-pointer"><X size={14} /></button>
                        </li>
                    ))}
                </ul>
                <form onSubmit={(e) => { e.preventDefault(); if (step.trim()) { patchItem({ steps: [...item.steps, { text: step.trim().slice(0, 300), done: false }] }); setStep(''); } }} className="mt-3 flex gap-2">
                    <input value={step} onChange={(e) => setStep(e.target.value)} placeholder="Přidat vlastní krok…" maxLength={300} className={inputCls} aria-label="Nový krok" />
                    <button type="submit" disabled={!step.trim()} className={ghostBtn}><Plus size={15} /> Přidat</button>
                </form>
            </section>

            <form onSubmit={(e) => { e.preventDefault(); void quickNote(); }} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="quick-note" className="text-sm font-semibold text-slate-900">Rychlá poznámka</label>
                <div className="mt-2 flex gap-2">
                    <input id="quick-note" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Co vás napadlo nebo co jste zjistili…" maxLength={140} className={inputCls} />
                    <button type="submit" disabled={!quick.trim()} className={ghostBtn}>Uložit</button>
                </div>
                {bundle.entries.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 size={13} /> Poznámky najdete v záložce Chronologie.</p>}
            </form>

            {offenses.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-900">Související přestupky a trestné činy</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                        {offenses.map((o) => <li key={o.id}><a href={`${PUBLIC_SITE}${getOffenseUrl(o.id, o.title)}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 text-indigo-900 hover:underline"><Gavel size={14} className="mt-0.5 shrink-0" />{o.title} · {o.lawSection}</a></li>)}
                    </ul>
                </section>
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/billing';
import { ACTION_LABEL, DEFAULT_YEARS, STATE_LABEL, addYears, archState, type ArchiveAction } from '@/lib/archive';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

type CaseArch = { id: string; title: string; status: string; archived_on?: string | null; archive_until?: string | null; archive_place?: string; disposed_on?: string | null; disposal?: string | null };
const dmy = (iso?: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '');
const MISSING = /archive_case|schema cache|does not exist/i;

// Archivace a skartace jedné věci: úkon se provede v databázi a zapíše do protokolu (funkce archive_case)
export async function archiveAction(caseId: string, action: ArchiveAction, on: string, until: string | null, place: string, note: string) {
    const { error } = await supabase.rpc('archive_case', { p_case: caseId, p_action: action, p_on: on, p_until: until, p_place: place, p_note: note });
    if (error) throw new Error(MISSING.test(error.message) ? 'Archiv se zapne po spuštění migrace 20261118_19.' : error.message);
}

export default function ArchiveCard({ item, onChanged }: { item: CaseArch; onChanged: () => void | Promise<void> }) {
    const today = todayIso();
    const state = archState(item, today);
    const [open, setOpen] = useState<ArchiveAction | null>(null);
    const [on, setOn] = useState(today);
    const [until, setUntil] = useState(addYears(today, DEFAULT_YEARS));
    const [place, setPlace] = useState(item.archive_place ?? '');
    const [note, setNote] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    if (state === 'aktivni') return null;

    function start(a: ArchiveAction) {
        setOpen(a); setErr(''); setConfirm(false); setNote(''); setOn(today);
        if (a === 'archivace') setUntil(addYears(today, DEFAULT_YEARS));
        if (a === 'prodlouzeni') setUntil(addYears(item.archive_until ?? today, 1));
    }
    async function run() {
        if (!open) return;
        setBusy(true); setErr('');
        try { await archiveAction(item.id, open, on, open === 'archivace' || open === 'prodlouzeni' ? until : null, place, note); setOpen(null); await onChanged(); }
        catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
    }
    const tone = state === 'uplynulo' ? 'border-rose-200 bg-rose-50/40' : state === 'brzy' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white';
    const irreversible = open === 'skartace' || open === 'vydani';

    return (
        <section aria-label="Archiv spisu" className={`rounded-2xl border p-4 sm:p-5 ${tone}`}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Archive size={16} className="text-indigo-700" aria-hidden="true" /> Archiv spisu <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">{STATE_LABEL[state]}</span></h3>
            {state === 'k-archivaci' && <p className="mt-1 text-sm text-slate-600">Věc je uzavřená. Archivujte spis: zapíše se datum, místo uložení a lhůta, po které ho lze vydat nebo skartovat.</p>}
            {item.archived_on && <p className="mt-1 text-sm text-slate-700">Archivováno {dmy(item.archived_on)}{item.archive_place ? `, uloženo: ${item.archive_place}` : ''}. Uložit do {dmy(item.archive_until)}.{item.disposed_on ? ` ${item.disposal === 'vydano' ? 'Vydáno' : 'Skartováno'} ${dmy(item.disposed_on)}.` : ''}</p>}
            {!open && !item.disposed_on && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {state === 'k-archivaci' && <button type="button" onClick={() => start('archivace')} className={primaryBtn}>Archivovat</button>}
                    {item.archived_on && <><button type="button" onClick={() => start('prodlouzeni')} className={ghostBtn}>Prodloužit lhůtu</button><button type="button" onClick={() => start('vydani')} className={ghostBtn}>Vydat spis</button>
                        <button type="button" onClick={() => start('skartace')} disabled={state !== 'uplynulo'} title={state !== 'uplynulo' ? 'Skartovat lze až po uplynutí lhůty' : ''} className={ghostBtn}>Skartovat</button>
                        <button type="button" onClick={() => start('zruseni')} className={ghostBtn}>Zrušit archivaci</button></>}
                </div>
            )}
            {open && (
                <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="mt-3 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-4">
                    <p className="text-sm font-bold text-slate-900 sm:col-span-4">{ACTION_LABEL[open]}</p>
                    <label className="text-xs font-semibold text-slate-600">Datum úkonu<input type="date" value={on} max={today} onChange={(e) => setOn(e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                    {(open === 'archivace' || open === 'prodlouzeni') && <label className="text-xs font-semibold text-slate-600">Uložit do<input type="date" value={until} min={on} onChange={(e) => setUntil(e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>}
                    {open === 'archivace' && <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Místo uložení<input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} placeholder="např. archiv, regál B, krabice 12" className={`${inputCls} mt-1 font-normal`} /></label>}
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-4">Poznámka do protokolu<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={open === 'vydani' ? 'komu a jak předáno (např. klientovi osobně, předávací protokol)' : open === 'skartace' ? 'jak skartováno, kým' : ''} className={`${inputCls} mt-1 font-normal`} /></label>
                    {open === 'archivace' && <p className="text-xs text-slate-500 sm:col-span-4">Předvyplněno {DEFAULT_YEARS} let. Délku uložení určete podle stavovských předpisů a povahy věci.</p>}
                    {irreversible && <label className="flex items-start gap-2 text-sm font-semibold text-rose-900 sm:col-span-4"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" /> {open === 'skartace' ? 'Potvrzuji, že listinný spis byl skartován. Úkon nejde vrátit.' : 'Potvrzuji, že spis byl vydán. Úkon nejde vrátit.'}</label>}
                    {open === 'skartace' && <p className="text-xs text-slate-600 sm:col-span-4">Zapíše se jen skartace listinného spisu. Elektronický spis v Kanceláři zůstává, smazat ho můžete ve věci zvlášť.</p>}
                    {err && <p role="alert" className="text-sm font-semibold text-rose-800 sm:col-span-4">{err}</p>}
                    <div className="flex gap-2 sm:col-span-4"><button type="submit" disabled={busy || (irreversible && !confirm)} className={primaryBtn}>{busy && <Loader2 size={14} className="animate-spin" />} Zapsat</button><button type="button" onClick={() => setOpen(null)} className={ghostBtn}>Zrušit</button></div>
                </form>
            )}
        </section>
    );
}

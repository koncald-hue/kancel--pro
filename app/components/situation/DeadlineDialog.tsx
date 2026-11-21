'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CaseDeadline } from '@/lib/caseFile';
import { inputCls, primaryBtn, ghostBtn } from './caseUi';

export type DeadlineTarget = {
    caseId: string; caseTitle?: string;
    // Bez source = nový záznam; 'law' = vypočtená lhůta (uloží se jako vlastní záznam s law_key); 'custom' = úprava
    source?: 'law' | 'custom'; customId?: string; lawKey?: string | null;
    title?: string; iso?: string; kind?: 'lhuta' | 'ukol'; confirmed?: boolean; assigneeId?: string | null; inquiryId?: string | null;
};
type Person = { user_id: string; name: string; is_owner: boolean };

export const MIGRATION_HINT = 'Tato část vyžaduje SQL migraci supabase/migrations/20261117_01_ukoly-a-potvrzeni-lhut.sql.';
const needsMigration = (msg: string) => /kind|assignee_id|confirmed_at|law_key|inquiry_id|case_people|schema cache/i.test(msg);

// Úprava lhůty nebo úkolu: datum, druh, odpovědná osoba a výslovné potvrzení data advokátem.
// Potvrzení je jen záznam, že datum zkontroloval člověk; aplikace sama žádnou lhůtu neověřuje.
export default function DeadlineDialog({ target, userId, onSaved, onClose }: { target: DeadlineTarget; userId: string; onSaved: (row: CaseDeadline) => void; onClose: () => void }) {
    const isNew = !target.source;
    const isLaw = target.source === 'law';
    const [title, setTitle] = useState(target.title ?? '');
    const [date, setDate] = useState(target.iso ?? '');
    const [kind, setKind] = useState<'lhuta' | 'ukol'>(target.kind ?? (isNew ? 'ukol' : 'lhuta'));
    const [assignee, setAssignee] = useState(target.assigneeId ?? '');
    const [confirm, setConfirm] = useState(!!target.confirmed);
    const [people, setPeople] = useState<Person[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const first = useRef<HTMLInputElement>(null);
    const close = useRef(onClose);
    useEffect(() => { close.current = onClose; }, [onClose]);

    useEffect(() => {
        let alive = true;
        supabase.rpc('case_people', { p_case: target.caseId }).then(({ data, error: e }) => { if (alive) setPeople(e ? [] : ((data ?? []) as Person[])); });
        const t = window.setTimeout(() => first.current?.focus(), 0);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
        window.addEventListener('keydown', onKey);
        return () => { alive = false; window.clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }, [target.caseId]);

    const dateChanged = !!target.iso && date !== target.iso;
    const mustConfirm = isLaw; // vypočtenou lhůtu má smysl uložit jen jako ověřenou
    const canSave = !!title.trim() && !!date && !busy && (!mustConfirm || confirm);

    async function save() {
        if (!canSave) return;
        setBusy(true); setError('');
        // Nová hodnota potvrzení = nové potvrzení (čas a jméno doplní databáze). Stejná hodnota = beze změny.
        const confirmedAt = kind === 'lhuta' && confirm ? (target.confirmed && !dateChanged ? 'keep' : new Date().toISOString()) : null;
        const base = { title: title.trim().slice(0, 200), due_date: date, kind, assignee_id: assignee || null };
        try {
            let row: CaseDeadline;
            if (target.source === 'custom' && target.customId) {
                const patch: Record<string, unknown> = { ...base };
                if (confirmedAt !== 'keep') patch.confirmed_at = confirmedAt;
                const { data, error: e } = await supabase.from('case_deadlines').update(patch).eq('id', target.customId).select('*').single();
                if (e) throw new Error(e.message);
                row = data as CaseDeadline;
            } else {
                const { data, error: e } = await supabase.from('case_deadlines').insert({ ...base, case_id: target.caseId, user_id: userId, confirmed_at: confirmedAt === 'keep' ? null : confirmedAt, law_key: isLaw ? target.lawKey : null, inquiry_id: target.inquiryId ?? null }).select('*').single();
                if (e) throw new Error(e.message);
                row = data as CaseDeadline;
            }
            onSaved(row);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(needsMigration(msg) ? MIGRATION_HINT : msg);
        } finally { setBusy(false); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
            <form role="dialog" aria-modal="true" aria-labelledby="dl-title" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void save(); }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="dl-title" className="text-lg font-bold text-slate-900">{isNew ? 'Nový úkol nebo lhůta' : isLaw ? 'Potvrdit vypočtenou lhůtu' : 'Upravit'}</h2>
                        {target.caseTitle && <p className="text-sm text-slate-500">{target.caseTitle}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                </div>

                {isLaw && <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Datum aplikace spočítala orientačně z data události. Nezná okolnosti doručení, přerušení ani zvláštní úpravu. Před uložením datum ověřte.</p>}

                <div className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-slate-800">Co je potřeba udělat
                        <input ref={first} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className={`${inputCls} mt-1`} />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-semibold text-slate-800">Datum
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`${inputCls} mt-1`} />
                        </label>
                        {!isLaw && (
                            <fieldset className="text-sm">
                                <legend className="font-semibold text-slate-800">Druh</legend>
                                <div className="mt-1 inline-flex rounded-lg border border-slate-300 p-0.5">
                                    {([['ukol', 'Úkol / termín'], ['lhuta', 'Lhůta']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={`rounded-md px-3 py-1.5 text-sm font-semibold cursor-pointer ${kind === id ? 'bg-indigo-800 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>{label}</button>)}
                                </div>
                            </fieldset>
                        )}
                    </div>
                    <label className="block text-sm font-semibold text-slate-800">Kdo to má na starosti
                        {people === null ? <span className="mt-1 block text-xs font-normal text-slate-500">Načítám…</span>
                            : people.length === 0 ? <span className="mt-1 block text-xs font-normal text-slate-500">Vlastník spisu. (Přiřazení kolegovi je možné u sdíleného spisu.)</span>
                                : <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${inputCls} mt-1`}>
                                    <option value="">Vlastník spisu</option>
                                    {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.user_id === userId ? `Já (${p.name})` : p.name}{p.is_owner ? ' · vlastník' : ''}</option>)}
                                </select>}
                    </label>
                    {kind === 'lhuta' && (
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" />
                            <span><strong>Datum lhůty jsem ověřil(a).</strong> <span className="text-slate-600">Uloží se, kdo a kdy datum potvrdil. Bez zaškrtnutí zůstane lhůta označená jako nepotvrzená.{target.confirmed && dateChanged ? ' Změnou data se dřívější potvrzení ruší.' : ''}</span></span>
                        </label>
                    )}
                </div>

                {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">{error}</p>}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={onClose} className={ghostBtn}>Zrušit</button>
                    <button type="submit" disabled={!canSave} className={primaryBtn}>{busy ? 'Ukládám…' : isLaw ? 'Potvrdit a uložit' : 'Uložit'}</button>
                </div>
            </form>
        </div>
    );
}

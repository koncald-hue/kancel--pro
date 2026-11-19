'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScrollText, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../site/AuthContext';
import { confirmAction } from '@/lib/confirm';
import { KIND_LABEL, STATE_LABEL, daysLeft, powerState, sortPowers, type Power, type PowerKind, type PowerState } from '@/lib/powers';
import { todayIso } from '@/lib/billing';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

const TONE: Record<PowerState, string> = { valid: 'bg-emerald-100 text-emerald-900', ending: 'bg-amber-100 text-amber-900', expired: 'bg-rose-100 text-rose-900', planned: 'bg-sky-100 text-sky-900' };
const dateCz = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');
const BLANK = { grantor: '', grantee: '', kind: 'special' as PowerKind, valid_from: '', valid_to: '', case_id: '', note: '' };

// Registr plných mocí: kdo komu dal plnou moc, k jaké věci a do kdy. Brzy končící a vypršelé jsou nahoře.
export default function PowersRegister() {
    const { account } = useAuth();
    const [list, setList] = useState<Power[] | null>(null);
    const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
    const [form, setForm] = useState(BLANK);
    const [adding, setAdding] = useState(false);
    const [filter, setFilter] = useState<'all' | PowerState>('all');
    const [error, setError] = useState('');
    const today = todayIso();

    const load = useCallback(async () => {
        const [p, c] = await Promise.all([supabase.from('powers_of_attorney').select('*').order('created_at', { ascending: false }), supabase.from('cases').select('id, title').order('title')]);
        if (p.error) { setError(/powers_of_attorney|schema cache|relation/i.test(p.error.message) ? 'Registr zatím není v databázi zapnutý (chybí migrace 20261119_27).' : p.error.message); setList([]); return; }
        setList((p.data ?? []) as Power[]);
        setCases((c.data ?? []) as { id: string; title: string }[]);
    }, []);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    const caseTitle = (id: string | null) => cases.find((c) => c.id === id)?.title;
    const shown = useMemo(() => sortPowers(list ?? [], today).filter((p) => filter === 'all' || powerState(p, today) === filter), [list, today, filter]);
    const counts = useMemo(() => { const c: Record<PowerState, number> = { valid: 0, ending: 0, expired: 0, planned: 0 }; (list ?? []).forEach((p) => { c[powerState(p, today)] += 1; }); return c; }, [list, today]);

    async function add(e: React.FormEvent) {
        e.preventDefault(); setError('');
        if (!account) return;
        if (form.valid_from && form.valid_to && form.valid_to < form.valid_from) { setError('Platnost do nemůže být dřív než platnost od.'); return; }
        const { error: err } = await supabase.from('powers_of_attorney').insert({ user_id: account.id, grantor: form.grantor.trim(), grantee: form.grantee.trim(), kind: form.kind, valid_from: form.valid_from || null, valid_to: form.valid_to || null, case_id: form.case_id || null, note: form.note.trim() });
        if (err) { setError(err.message); return; }
        setForm(BLANK); setAdding(false); await load();
    }
    async function remove(p: Power) {
        if (!await confirmAction(`Smazat plnou moc od „${p.grantor}“?`, { confirmLabel: 'Smazat' })) return;
        const { error: err } = await supabase.from('powers_of_attorney').delete().eq('id', p.id);
        if (err) setError(err.message); else await load();
    }

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ScrollText size={22} className="text-indigo-800" /> Registr plných mocí</h1>
                    <p className="mt-1 text-sm text-slate-600">Kdo vám dal plnou moc, k jaké věci a do kdy. Kdo brzy končí, je nahoře.</p>
                </div>
                {!adding && <button type="button" onClick={() => setAdding(true)} className={primaryBtn}><Plus size={15} /> Přidat plnou moc</button>}
            </header>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

            {adding && (
                <form onSubmit={add} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2" aria-label="Nová plná moc">
                    <label className="text-xs font-semibold text-slate-700">Zmocnitel (kdo plnou moc dal)<input required value={form.grantor} onChange={(e) => setForm({ ...form, grantor: e.target.value })} maxLength={200} className={`${inputCls} mt-1`} /></label>
                    <label className="text-xs font-semibold text-slate-700">Zmocněnec (komu)<input value={form.grantee} onChange={(e) => setForm({ ...form, grantee: e.target.value })} maxLength={200} placeholder="vy nebo kolega" className={`${inputCls} mt-1`} /></label>
                    <label className="text-xs font-semibold text-slate-700">Druh<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PowerKind })} className={`${inputCls} mt-1`}>{(Object.keys(KIND_LABEL) as PowerKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-700">K věci (nepovinné)<select value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })} className={`${inputCls} mt-1`}><option value="">Bez věci</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-700">Platí od<input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className={`${inputCls} mt-1`} /></label>
                    <label className="text-xs font-semibold text-slate-700">Platí do (prázdné = bez omezení)<input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} className={`${inputCls} mt-1`} /></label>
                    <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Poznámka<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={1000} className={`${inputCls} mt-1`} /></label>
                    <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={!form.grantor.trim()} className={primaryBtn}>Uložit</button><button type="button" onClick={() => { setAdding(false); setForm(BLANK); }} className={ghostBtn}>Zrušit</button></div>
                </form>
            )}

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr podle stavu">
                {([['all', `Vše (${list?.length ?? 0})`], ['ending', `Brzy končí (${counts.ending})`], ['valid', `Platné (${counts.valid})`], ['expired', `Vypršelé (${counts.expired})`], ['planned', `Budoucí (${counts.planned})`]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={`cursor-pointer rounded-full border px-3.5 py-1 text-xs font-semibold ${filter === v ? 'border-indigo-800 bg-indigo-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{l}</button>)}
            </div>

            {list === null ? <p className="text-sm text-slate-500" role="status">Načítám…</p> : shown.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{list.length === 0 ? 'Zatím tu není žádná plná moc. Přidejte první tlačítkem nahoře.' : 'Žádná plná moc neodpovídá filtru.'}</p>
            ) : (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                    {shown.map((p) => {
                        const st = powerState(p, today); const left = daysLeft(p, today);
                        return (
                            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900">{p.grantor}{p.grantee && <span className="font-normal text-slate-600"> → {p.grantee}</span>}</p>
                                    <p className="text-xs text-slate-600">{KIND_LABEL[p.kind]} · {dateCz(p.valid_from)} až {p.valid_to ? dateCz(p.valid_to) : 'bez omezení'}{p.case_id && caseTitle(p.case_id) && <> · <Link href={`/kancelar/veci/${p.case_id}`} className="font-semibold text-indigo-800 hover:underline">{caseTitle(p.case_id)}</Link></>}{p.note && ` · ${p.note}`}</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[st]}`}>{STATE_LABEL[st]}{st === 'ending' && left !== null ? ` (${left} d)` : ''}</span>
                                <button type="button" onClick={() => void remove(p)} aria-label={`Smazat plnou moc od ${p.grantor}`} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

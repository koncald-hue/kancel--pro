'use client';

import { confirmAction } from '@/lib/confirm';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, UserRoundCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/billing';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

export type Sub = { id: string; user_id: string; substitute_id: string; from_on: string; to_on: string; note: string; user_name: string; substitute_name: string };
const dmy = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ');
const active = (s: Sub, t: string) => s.from_on <= t && t <= s.to_on;

export async function loadSubs(): Promise<Sub[] | null> {
    const { data, error } = await supabase.rpc('my_substitutions');
    return error ? null : (data ?? []) as Sub[];
}

// Zastupování v týmu: kdo mě zastupuje během nepřítomnosti a koho zastupuji já
export default function Substitutions({ colleagues }: { colleagues: { user_id: string; name: string }[] }) {
    const { userId } = useLawyer();
    const [subs, setSubs] = useState<Sub[] | null>(null);
    const today = todayIso();
    const [form, setForm] = useState({ substitute_id: '', from_on: today, to_on: today, note: '' });
    const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const load = useCallback(async () => setSubs(await loadSubs()), []);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);

    if (subs === null) return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Zastupování se zapne po spuštění migrace 20261118_19.</section>;
    const others = colleagues.filter((c) => c.user_id !== userId);
    const mine = subs.filter((s) => s.user_id === userId);
    const forOthers = subs.filter((s) => s.substitute_id === userId);

    async function add() {
        if (!form.substitute_id) { setErr('Vyberte zástupce.'); return; }
        if (form.to_on < form.from_on) { setErr('Konec musí být po začátku.'); return; }
        setBusy(true); setErr('');
        const { error } = await supabase.from('substitutions').insert({ user_id: userId, substitute_id: form.substitute_id, from_on: form.from_on, to_on: form.to_on, note: form.note.trim().slice(0, 300) });
        setBusy(false);
        if (error) { setErr(/check/i.test(error.message) ? 'Zastupování může trvat nejvýš rok a zástupce musí být někdo jiný.' : error.message); return; }
        setForm({ substitute_id: '', from_on: today, to_on: today, note: '' }); await load();
    }
    const remove = async (s: Sub) => { if (await confirmAction('Zrušit zastupování?')) { await supabase.from('substitutions').delete().eq('id', s.id); await load(); } };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Zastupování">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserRoundCheck size={18} className="text-indigo-700" aria-hidden="true" /> Zastupování při nepřítomnosti</h2>
            <p className="mt-1 text-sm text-slate-600">Na dobu dovolené nebo nemoci určete kolegu z kanceláře. Po tu dobu uvidí a smí upravovat vaše spisy, lhůty a úkoly, vidí váš podací deník a vaše lhůty mu přijdou i v souhrnu. Vaši e-mailovou ani datovou schránku nevidí, ty jsou chráněné vaším šifrovacím heslem. Po skončení období přístup sám zanikne.</p>
            {forOthers.filter((s) => s.to_on >= today).map((s) => <p key={s.id} className={`mt-3 rounded-lg p-3 text-sm ${active(s, today) ? 'bg-indigo-50 text-indigo-950' : 'bg-slate-50 text-slate-700'}`}>{active(s, today) ? 'Právě zastupujete' : 'Budete zastupovat'} <strong>{s.user_name}</strong> od {dmy(s.from_on)} do {dmy(s.to_on)}.{s.note ? ` ${s.note}` : ''} {active(s, today) && <Link href="/kancelar/veci" className="font-semibold underline">Jeho spisu najdete ve Spisech</Link>}</p>)}
            {mine.length > 0 && <ul className="mt-3 divide-y divide-slate-100 text-sm">{mine.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-2 py-2"><span className="min-w-0 flex-1">Zastupuje vás <strong>{s.substitute_name}</strong> od {dmy(s.from_on)} do {dmy(s.to_on)}{s.note ? ` · ${s.note}` : ''}{active(s, today) ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">teď</span> : s.to_on < today ? <span className="ml-2 text-xs text-slate-400">skončilo</span> : null}</span><button type="button" onClick={() => void remove(s)} aria-label="Zrušit zastupování" className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button></li>)}</ul>}
            {others.length === 0 ? <p className="mt-3 text-sm text-slate-500">V kanceláři zatím nemáte kolegu, který by vás mohl zastupovat.</p> : (
                <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="mt-3 grid gap-2 sm:grid-cols-5">
                    <select value={form.substitute_id} onChange={(e) => setForm({ ...form, substitute_id: e.target.value })} aria-label="Zástupce" className={`${inputCls} sm:col-span-2`}><option value="">Kdo mě zastoupí…</option>{others.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}</select>
                    <label className="text-xs text-slate-600">Od<input type="date" value={form.from_on} min={today} onChange={(e) => setForm({ ...form, from_on: e.target.value, to_on: form.to_on < e.target.value ? e.target.value : form.to_on })} className={`${inputCls} mt-0.5`} /></label>
                    <label className="text-xs text-slate-600">Do<input type="date" value={form.to_on} min={form.from_on} onChange={(e) => setForm({ ...form, to_on: e.target.value })} className={`${inputCls} mt-0.5`} /></label>
                    <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} placeholder="Poznámka (např. dovolená)" aria-label="Poznámka" className={inputCls} />
                    <div className="sm:col-span-5"><button type="submit" disabled={busy} className={primaryBtn}>Nastavit zastupování</button></div>
                </form>
            )}
            {err && <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">{err}</p>}
            <p className="mt-2 text-xs text-slate-500">Zastupování vidíte jen vy a váš zástupce. <button type="button" onClick={() => void load()} className={`${ghostBtn} px-2 py-0.5 text-xs`}>Obnovit</button></p>
        </section>
    );
}

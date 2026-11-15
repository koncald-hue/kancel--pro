'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../site/AuthContext';
import { supabase } from '@/lib/supabase';
import { OFFENSES_DATABASE } from '@/app/data/offenses';
import { inputCls, primaryBtn } from '../situation/caseUi';

type Law = { id: string; court: string; ref: string; ecli: string; decided_on: string | null; title: string; holding: string; url: string; topics: string[]; offense_ids: string[]; verified: boolean };

const COURTS = ['Ústavní soud', 'Nejvyšší soud', 'Nejvyšší správní soud', 'Evropský soud pro lidská práva', 'Soudní dvůr EU', 'Krajský soud', 'Vrchní soud'];
const EMPTY = { court: COURTS[1], ref: '', ecli: '', decided_on: '', title: '', holding: '', url: '', topics: '', offenses: '' };

// Knihovna ověřené judikatury: obrana ve spisu smí citovat jen rozhodnutí odsud
export default function CaseLawAdmin() {
    const { isStaff, authReady, account } = useAuth();
    const [items, setItems] = useState<Law[]>([]);
    const [form, setForm] = useState(EMPTY);
    const [message, setMessage] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (!isStaff) return;
        let cancelled = false;
        supabase.from('case_law').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
            if (cancelled) return;
            if (error) setMessage('Knihovna není v databázi zapnutá (chybí SQL defense.sql).');
            else setItems((data ?? []) as Law[]);
        });
        return () => { cancelled = true; };
    }, [isStaff, reload]);

    if (!authReady) return <p className="max-w-3xl mx-auto px-4 py-12 text-sm text-slate-500" role="status">Načítám…</p>;
    if (!account || !isStaff) return <p className="max-w-3xl mx-auto px-4 py-12 text-sm text-slate-600">Tato stránka je jen pro členy týmu.</p>;

    const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

    async function add() {
        const offenseIds = form.offenses.split(',').map((x) => x.trim()).filter(Boolean);
        const unknown = offenseIds.filter((id) => !OFFENSES_DATABASE.some((o) => o.id === id));
        if (unknown.length) { setMessage(`Neznámé ID deliktu: ${unknown.join(', ')}`); return; }
        const { error } = await supabase.from('case_law').insert({
            court: form.court, ref: form.ref.trim(), ecli: form.ecli.trim(), decided_on: form.decided_on || null, title: form.title.trim(), holding: form.holding.trim(), url: form.url.trim(),
            topics: form.topics.split(',').map((x) => x.trim()).filter(Boolean), offense_ids: offenseIds, verified: true,
        });
        if (error) { setMessage(error.code === '23505' ? 'Rozhodnutí s touto značkou už v knihovně je.' : error.message); return; }
        setForm(EMPTY); setMessage('Uloženo a označeno jako ověřené.'); setReload((n) => n + 1);
    }

    async function remove(id: string) {
        if (!window.confirm('Smazat rozhodnutí z knihovny?')) return;
        const { error } = await supabase.from('case_law').delete().eq('id', id);
        if (error) setMessage(error.message); else setReload((n) => n + 1);
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-800 hover:underline"><ArrowLeft size={15} /> Správa</Link>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Knihovna judikatury</h1>
            <p className="mt-1 text-sm text-slate-600">Přidávejte jen rozhodnutí, která jste sami ověřili v oficiální databázi soudu. Obrana ve spisu bude citovat výhradně tato rozhodnutí.</p>

            {message && <p role="status" className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-slate-800">{message}</p>}

            <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="mt-6 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                <select value={form.court} onChange={set('court')} className={inputCls} aria-label="Soud">{COURTS.map((c) => <option key={c}>{c}</option>)}</select>
                <input value={form.ref} onChange={set('ref')} placeholder="Spisová značka (např. 4 Tdo 123/2020)" required className={inputCls} aria-label="Spisová značka" />
                <input value={form.ecli} onChange={set('ecli')} placeholder="ECLI (nepovinné)" className={inputCls} aria-label="ECLI" />
                <input type="date" value={form.decided_on} onChange={set('decided_on')} className={inputCls} aria-label="Datum rozhodnutí" />
                <input value={form.title} onChange={set('title')} placeholder="Název / téma rozhodnutí" required className={`${inputCls} sm:col-span-2`} aria-label="Název" />
                <textarea value={form.holding} onChange={set('holding')} placeholder="Právní věta nebo stručný závěr vlastními slovy" required rows={3} className={`${inputCls} sm:col-span-2`} aria-label="Právní věta" />
                <input type="url" value={form.url} onChange={set('url')} placeholder="Odkaz na rozhodnutí v databázi soudu" required className={`${inputCls} sm:col-span-2`} aria-label="Odkaz" />
                <input value={form.topics} onChange={set('topics')} placeholder="Témata, oddělte čárkou (např. doručování, trestní příkaz)" className={inputCls} aria-label="Témata" />
                <input value={form.offenses} onChange={set('offenses')} placeholder="ID souvisejících deliktů z katalogu (např. 1, 2)" className={inputCls} aria-label="ID deliktů" />
                <button type="submit" className={`${primaryBtn} sm:col-span-2 justify-center`}><Check size={16} /> Přidat jako ověřené</button>
            </form>

            <ul className="mt-6 space-y-3">
                {items.map((l) => (
                    <li key={l.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div><p className="text-sm font-semibold text-slate-900">{l.court}, {l.ref}</p><p className="text-xs text-slate-500">{l.title}</p></div>
                            <button type="button" onClick={() => void remove(l.id)} aria-label={`Smazat ${l.ref}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-700">{l.holding}</p>
                    </li>
                ))}
                {items.length === 0 && !message && <li className="text-sm text-slate-500">Knihovna je zatím prázdná.</li>}
            </ul>
        </div>
    );
}

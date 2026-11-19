'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_FILTER, isDefault, parseFilter, type CaseFilter } from '@/lib/savedViews';
import { inputCls } from './caseUi';

type View = { id: string; name: string; filter: CaseFilter };

// Uložené přehledy: řada tlačítek se jmény přehledů, uložení aktuálního filtru pod názvem a smazání
export default function SavedViews({ userId, filter, onApply }: { userId: string; filter: CaseFilter; onApply: (f: CaseFilter) => void }) {
    const [views, setViews] = useState<View[] | null>(null);
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const { data, error: err } = await supabase.from('saved_views').select('id, name, filter').eq('scope', 'cases').order('created_at');
        if (err) { setViews(null); return; } // bez migrace 20261119_27 se funkce tiše skryje
        setViews((data ?? []).map((v) => ({ id: v.id as string, name: v.name as string, filter: parseFilter(v.filter) })));
    }, []);
    useEffect(() => { let alive = true; Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        const { error: err } = await supabase.from('saved_views').insert({ user_id: userId, scope: 'cases', name: n.slice(0, 60), filter });
        if (err) { setError(err.message); return; }
        setName(''); setNaming(false); setError(''); await load();
    }
    async function remove(id: string) {
        await supabase.from('saved_views').delete().eq('id', id);
        await load();
    }

    if (views === null) return null;
    const active = views.find((v) => JSON.stringify(v.filter) === JSON.stringify(filter));
    return (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Uložené přehledy">
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Bookmark size={13} aria-hidden="true" /> Přehledy:</span>
            {views.length === 0 && !naming && <span className="text-xs text-slate-500">Nastavte filtr a uložte si ho jako přehled.</span>}
            {views.map((v) => (
                <span key={v.id} className={`inline-flex items-center rounded-full border text-xs font-semibold ${active?.id === v.id ? 'border-indigo-800 bg-indigo-800 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>
                    <button type="button" onClick={() => onApply(v.filter)} className="cursor-pointer rounded-full py-1 pl-3 pr-2">{v.name}</button>
                    <button type="button" onClick={() => void remove(v.id)} aria-label={`Smazat přehled ${v.name}`} className="cursor-pointer rounded-full py-1 pr-2 opacity-70 hover:opacity-100"><X size={12} /></button>
                </span>
            ))}
            {!isDefault(filter) && !active && !naming && <button type="button" onClick={() => setNaming(true)} className="cursor-pointer text-xs font-semibold text-indigo-800 hover:underline">Uložit tento filtr</button>}
            {!isDefault(filter) && <button type="button" onClick={() => onApply(DEFAULT_FILTER)} className="cursor-pointer text-xs font-semibold text-slate-600 hover:underline">Zrušit filtr</button>}
            {naming && <form onSubmit={save} className="flex items-center gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Název přehledu" aria-label="Název přehledu" maxLength={60} autoFocus className={`${inputCls} w-44 py-1`} /><button type="submit" className="cursor-pointer text-xs font-bold text-indigo-800">Uložit</button><button type="button" onClick={() => setNaming(false)} className="cursor-pointer text-xs text-slate-600">Zrušit</button></form>}
            {error && <span role="alert" className="text-xs text-rose-800">{error}</span>}
        </div>
    );
}

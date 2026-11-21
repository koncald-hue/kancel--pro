'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';

type Row = { id: string; created_at: string; source: string; message: string; stack: string; page: string; ua: string; fingerprint: string };
type Group = { fp: string; message: string; page: string; stack: string; count: number; last: string; ua: string; boundary: boolean };

// Chyby z prohlížečů uživatelů: stejné chyby na stejné stránce jsou sloučené, nahoře jsou nejčerstvější
export default function AdminErrors() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        const { data, error: e } = await supabase.from('app_errors').select('id, created_at, source, message, stack, page, ua, fingerprint').order('created_at', { ascending: false }).limit(500);
        if (e) { setMissing(true); return; }
        setRows((data ?? []) as Row[]);
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
    async function remove(fp: string) { if (!await confirmAction('Smazat tuto chybu ze záznamu?')) return; setError(''); const { error: e } = await supabase.from('app_errors').delete().eq('fingerprint', fp); if (e) setError(e.message); await load(); }

    if (missing) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Záznam chyb zatím není v databázi zapnutý (chybí spuštění souboru zaznam-chyb.sql).</p>;
    if (!rows) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!rows.length) return <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Žádné chyby. Záznam se plní, kdykoli se v prohlížeči uživatele něco pokazí.</p>;
    const groups = new Map<string, Group>();
    for (const r of rows) {
        const g = groups.get(r.fingerprint);
        if (g) g.count += 1; else groups.set(r.fingerprint, { fp: r.fingerprint, message: r.message, page: r.page, stack: r.stack, count: 1, last: r.created_at, ua: r.ua, boundary: r.source === 'boundary' });
    }
    return (
        <div className="space-y-3">
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {[...groups.values()].map((g) => (
                <article key={g.fp} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-900">{g.count}×</span>
                        {g.boundary && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">uživatel viděl chybovou stránku</span>}
                        <span className="flex-1 text-xs text-slate-500">{g.page || '/'} · naposledy {new Date(g.last).toLocaleString('cs-CZ')}</span>
                        <button type="button" onClick={() => void remove(g.fp)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50"><Trash2 size={14} /> Smazat</button>
                    </div>
                    <p className="mt-2 break-words font-semibold text-slate-900">{g.message || '(bez textu)'}</p>
                    {g.stack && <details className="mt-1"><summary className="cursor-pointer text-xs text-slate-500">Podrobnosti</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{g.stack}{'\n\n'}{g.ua}</pre></details>}
                </article>))}
        </div>
    );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Row = { id: number; staff_id: string | null; action: string; target: string; detail: string; created_at: string };

// Záznam úkonů správce (jen přibývá) a poznámky k uživatelům
export default function AdminLog() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [names, setNames] = useState<Record<string, string>>({});
    const [q, setQ] = useState('');
    useEffect(() => {
        let a = true;
        Promise.all([supabase.from('ops_log').select('*').order('created_at', { ascending: false }).limit(1000), supabase.from('lawyer_access').select('user_id, email, display_name')]).then(([l, la]) => {
            if (!a) return;
            setRows(l.error ? [] : (l.data ?? []) as Row[]);
            setNames(Object.fromEntries(((la.data ?? []) as { user_id: string; email: string; display_name?: string }[]).map((x) => [x.user_id, x.display_name || x.email])));
        });
        return () => { a = false; };
    }, []);
    const shown = useMemo(() => { const t = q.trim().toLowerCase(); return (rows ?? []).filter((r) => !t || `${r.action} ${r.target} ${r.detail} ${names[r.staff_id ?? ''] ?? ''}`.toLowerCase().includes(t)); }, [rows, q, names]);
    if (rows === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    return (
        <div className="space-y-3">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat v záznamu…" aria-label="Hledat v záznamu" className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Zatím žádný zaznamenaný úkon (po spuštění migrace účetnictví provozovatele se sem zapisují ruční faktury, dobropisy, výdaje, změny přístupů a nastavení).</p> : (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">
                    {shown.map((r) => <li key={r.id} className="flex flex-wrap gap-x-3 px-4 py-2"><span className="w-36 text-slate-500">{new Date(r.created_at).toLocaleString('cs-CZ')}</span><span className="w-40 font-semibold text-slate-900">{r.action}</span><span className="min-w-0 flex-1 text-slate-700">{[r.target, r.detail].filter(Boolean).join(' · ')}</span><span className="text-xs text-slate-500">{names[r.staff_id ?? ''] ?? ''}</span></li>)}
                </ul>
            )}
            <p className="text-xs text-slate-500">Záznam nejde upravit ani smazat. Poznámky k jednotlivým uživatelům najdete v Uživatelé a předplatné po rozkliknutí uživatele.</p>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Stage = { key: string; label: string; n: number | null };

// Kde lidé odpadají: kolik z těch, kdo se za 60 dní zaregistrovali, došlo do dané fáze
export default function AdminFunnel() {
    const [stages, setStages] = useState<Stage[] | null>(null);
    const [err, setErr] = useState(false);
    useEffect(() => {
        let a = true;
        (async () => {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) throw new Error('no session');
            const res = await fetch('/api/admin/funnel', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            if (!res.ok) throw new Error('bad');
            const body = await res.json() as { stages: Stage[] };
            if (a) setStages(body.stages);
        })().catch(() => { if (a) setErr(true); });
        return () => { a = false; };
    }, []);
    const total = stages?.[0]?.n || 0;
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Kde lidé odpadají">
            <h2 className="font-bold text-slate-900">Kde lidé odpadají</h2>
            <p className="text-xs text-slate-500">Registrace za posledních 60 dní. Počítají se jen lidé, ne obsah spisů.</p>
            {err ? <p className="mt-3 text-sm text-slate-600">Přehled se nepodařilo načíst.</p> : !stages ? <p className="mt-3 text-sm text-slate-500" role="status">Načítám…</p> : (
                <ul className="mt-3 space-y-2">
                    {stages.map((s) => {
                        const pct = s.n !== null && total ? Math.round((s.n / total) * 100) : 0;
                        return (
                            <li key={s.key}>
                                <div className="flex justify-between text-sm"><span className="text-slate-800">{s.label}</span><span className="font-semibold text-slate-900">{s.n === null ? '–' : `${s.n}${total ? ` (${pct} %)` : ''}`}</span></div>
                                <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} /></div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

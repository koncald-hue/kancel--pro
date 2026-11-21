'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Stage = { key: string; label: string; n: number | null };
type Stale = { email: string; days: number };
const MAIL_BODY = 'Dobrý den,\n\nvšiml jsem si, že jste si před pár dny založil(a) zkušební přístup do Kanceláře Pro, ale zatím jste v ní nic nezačal(a). Mohu se zeptat, co vám v tom zabránilo? Bylo něco nejasné, nebo vám něco chybělo? Každá odpověď mi pomůže program zlepšit, a rád vám s nastavením pomohu.\n\nDěkuji';

// Kde lidé odpadají: kolik z těch, kdo se za 60 dní zaregistrovali, došlo do dané fáze
export default function AdminFunnel() {
    const [stages, setStages] = useState<Stage[] | null>(null);
    const [stale, setStale] = useState<Stale[]>([]);
    const [err, setErr] = useState(false);
    useEffect(() => {
        let a = true;
        (async () => {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) throw new Error('no session');
            const res = await fetch('/api/admin/funnel', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            if (!res.ok) throw new Error('bad');
            const body = await res.json() as { stages: Stage[]; stale?: Stale[] };
            if (a) { setStages(body.stages); setStale(body.stale ?? []); }
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
            {stale.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-bold text-slate-900">Zaregistrovali se a nic nezačali</h3>
                    <p className="text-xs text-slate-500">Napište jim a zeptejte se, co jim v tom zabránilo. Odpovědi jsou nejlepší zpětná vazba.</p>
                    <ul className="mt-2 space-y-1">{stale.map((x) => <li key={x.email} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-slate-800">{x.email} <span className="text-xs text-slate-400">před {x.days} {x.days === 1 ? 'dnem' : 'dny'}</span></span><a href={`mailto:${x.email}?subject=${encodeURIComponent('Jak se vám daří s Kanceláří Pro?')}&body=${encodeURIComponent(MAIL_BODY)}`} className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Napsat</a></li>)}</ul>
                </div>
            )}
        </section>
    );
}

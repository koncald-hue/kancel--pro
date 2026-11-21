'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Star, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import type { Review, ReviewStatus } from '@/lib/testimonials';

type Row = Review & { user_id: string };
const LABEL: Record<ReviewStatus, string> = { pending: 'Čeká na schválení', approved: 'Zveřejněno', rejected: 'Zamítnuto' };

// Schvalování recenzí uživatelů: na úvodní stránku se dostanou jen schválené
export default function AdminReviews() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        const { data, error: e } = await supabase.from('testimonials').select('id, user_id, rating, body, display_name, role_label, status, created_at').order('created_at', { ascending: false });
        if (e) { setMissing(true); return; }
        setRows((data ?? []) as Row[]);
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

    async function decide(r: Row, status: ReviewStatus) { setError(''); const { error: e } = await supabase.from('testimonials').update({ status }).eq('id', r.id); if (e) setError(e.message); await load(); }
    async function remove(r: Row) { if (!await confirmAction('Smazat recenzi?')) return; const { error: e } = await supabase.from('testimonials').delete().eq('id', r.id); if (e) setError(e.message); await load(); }

    if (missing) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Recenze zatím nejsou v databázi zapnuté (chybí spuštění souboru recenze.sql).</p>;
    if (!rows) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!rows.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Zatím nikdo recenzi neposlal. Uživatelé se na hodnocení zeptají sami po několika dnech zkoušení.</p>;
    return (
        <div className="space-y-3">
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {rows.map((r) => (
                <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex gap-0.5 text-amber-500" aria-label={`${r.rating} z 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} fill={n <= r.rating ? 'currentColor' : 'none'} className={n <= r.rating ? '' : 'text-slate-300'} aria-hidden="true" />)}</span>
                        <strong className="flex-1 text-slate-900">{r.display_name}{r.role_label ? <span className="font-normal text-slate-500"> · {r.role_label}</span> : null}</strong>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-900' : r.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{LABEL[r.status]}</span>
                    </div>
                    <p className="mt-2 leading-relaxed text-slate-700">„{r.body}“</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('cs-CZ')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {r.status !== 'approved' && <button type="button" onClick={() => void decide(r, 'approved')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"><Check size={14} /> Zveřejnit</button>}
                        {r.status !== 'rejected' && <button type="button" onClick={() => void decide(r, 'rejected')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><X size={14} /> {r.status === 'approved' ? 'Stáhnout' : 'Zamítnout'}</button>}
                        <button type="button" onClick={() => void remove(r)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50"><Trash2 size={14} /> Smazat</button>
                    </div>
                </article>))}
        </div>
    );
}

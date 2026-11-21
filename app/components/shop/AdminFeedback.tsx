'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Mail, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import { FEEDBACK_KINDS } from '@/lib/feedback';

type Row = { id: string; email: string; kind: string; message: string; page: string; status: 'new' | 'done'; created_at: string };

// Zprávy od uživatelů z tlačítka „Nahlásit problém nebo nápad“
export default function AdminFeedback() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        const { data, error: e } = await supabase.from('feedback').select('id, email, kind, message, page, status, created_at').order('created_at', { ascending: false }).limit(300);
        if (e) { setMissing(true); return; }
        setRows((data ?? []) as Row[]);
    }, []);
    useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
    async function mark(r: Row, status: 'new' | 'done') { setError(''); const { error: e } = await supabase.from('feedback').update({ status }).eq('id', r.id); if (e) setError(e.message); await load(); }
    async function remove(r: Row) { if (!await confirmAction('Smazat zprávu?')) return; const { error: e } = await supabase.from('feedback').delete().eq('id', r.id); if (e) setError(e.message); await load(); }

    if (missing) return <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">Zpětná vazba zatím není v databázi zapnutá (chybí spuštění souboru zpetna-vazba.sql).</p>;
    if (!rows) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (!rows.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Zatím nepřišla žádná zpráva. Tlačítko „Nahlásit problém nebo nápad“ je v menu aplikace.</p>;
    return (
        <div className="space-y-3">
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {rows.map((r) => (
                <article key={r.id} className={`rounded-2xl border p-4 text-sm ${r.status === 'new' ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{FEEDBACK_KINDS.find((k) => k.id === r.kind)?.label ?? r.kind}</span>
                        <strong className="flex-1 text-slate-900">{r.email || 'bez e-mailu'}</strong>
                        <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString('cs-CZ')}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-800">{r.message}</p>
                    {r.page && <p className="mt-1 text-xs text-slate-400">Stránka: {r.page}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {r.email && <a href={`mailto:${r.email}?subject=${encodeURIComponent('Vaše zpráva v Kanceláři Pro')}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Mail size={14} /> Odpovědět</a>}
                        {r.status === 'new' ? <button type="button" onClick={() => void mark(r, 'done')} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"><Check size={14} /> Vyřízeno</button> : <button type="button" onClick={() => void mark(r, 'new')} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">Vrátit mezi nové</button>}
                        <button type="button" onClick={() => void remove(r)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50"><Trash2 size={14} /> Smazat</button>
                    </div>
                </article>))}
        </div>
    );
}

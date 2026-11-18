'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Poznámka týmu k uživateli (např. „domluvena sleva“, „platí převodem“). Vidí ji jen tým.
export default function AdminNote({ userId }: { userId: string }) {
    const [note, setNote] = useState<string | null>(null);
    const [saved, setSaved] = useState('');
    useEffect(() => { let a = true; supabase.from('ops_notes').select('note').eq('user_id', userId).maybeSingle().then(({ data, error }) => { if (a) setNote(error ? null : String(data?.note ?? '')); }); return () => { a = false; }; }, [userId]);
    if (note === null) return null;
    async function save(v: string) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('ops_notes').upsert({ user_id: userId, note: v.slice(0, 2000), updated_by: user?.id, updated_at: new Date().toISOString() });
        setSaved(error ? error.message : 'Uloženo.'); window.setTimeout(() => setSaved(''), 1500);
    }
    return (
        <label className="mt-3 block text-xs font-semibold text-slate-600">Poznámka týmu (vidí jen tým)
            <textarea defaultValue={note} onBlur={(e) => { if (e.target.value !== note) { setNote(e.target.value); void save(e.target.value); } }} rows={2} maxLength={2000} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
            {saved && <span role="status" className="text-xs font-normal text-emerald-800">{saved}</span>}
        </label>
    );
}

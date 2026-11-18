'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserRoundCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/billing';
import { loadSubs, type Sub } from './Substitutions';
import { useLawyer } from './LawyerGate';

const dmy = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ');
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Na ploše Dnes: koho právě zastupuji a kolik jeho lhůt a úkolů je po termínu nebo na příštích 7 dní
export default function SubstituteBanner() {
    const { userId } = useLawyer();
    const [rows, setRows] = useState<(Sub & { late: number; soon: number })[]>([]);
    useEffect(() => {
        let a = true;
        (async () => {
            const subs = await loadSubs(); const today = todayIso();
            const act = (subs ?? []).filter((s) => s.substitute_id === userId && s.from_on <= today && today <= s.to_on);
            const out: (Sub & { late: number; soon: number })[] = [];
            for (const s of act) {
                const c = await supabase.from('cases').select('id').eq('user_id', s.user_id).eq('status', 'open');
                const ids = ((c.data ?? []) as { id: string }[]).map((x) => x.id);
                const d = ids.length ? await supabase.from('case_deadlines').select('due_date').in('case_id', ids).eq('done', false).lte('due_date', addDays(today, 7)) : { data: [] };
                const ds = (d.data ?? []) as { due_date: string }[];
                out.push({ ...s, late: ds.filter((x) => x.due_date < today).length, soon: ds.filter((x) => x.due_date >= today).length });
            }
            if (a) setRows(out);
        })().catch(() => undefined);
        return () => { a = false; };
    }, [userId]);
    if (!rows.length) return null;
    return (
        <>{rows.map((s) => (
            <Link key={s.id} href="/kancelar/veci" className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm hover:shadow-sm ${s.late ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-indigo-200 bg-indigo-50 text-indigo-950'}`}>
                <UserRoundCheck size={18} aria-hidden="true" />
                <span className="min-w-0 flex-1"><strong>Zastupujete {s.user_name}</strong> do {dmy(s.to_on)}. {s.late ? `Po termínu: ${s.late}. ` : ''}Na 7 dní: {s.soon} {s.soon === 1 ? 'termín' : s.soon >= 2 && s.soon <= 4 ? 'termíny' : 'termínů'}.</span>
                <span className="font-semibold underline">Otevřít věci</span>
            </Link>
        ))}</>
    );
}

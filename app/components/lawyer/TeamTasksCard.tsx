'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Flag, ListTodo } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/billing';
import type { TeamTask } from '@/lib/agenda';
import { loadNames } from '@/lib/teamTasks';
import { useLawyer } from './LawyerGate';

// Na ploše Dnes: otevřené úkoly pro mě (od kolegů i vlastní) na příštích 7 dní a po termínu, s tlačítkem Hotovo
export default function TeamTasksCard() {
    const { userId } = useLawyer();
    const [list, setList] = useState<TeamTask[]>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const today = todayIso();
    const load = useCallback(async () => {
        const until = new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
        const { data, error } = await supabase.from('team_tasks').select('*').eq('assignee_id', userId).eq('status', 'open').lte('due_date', until).order('due_date').limit(8);
        if (error) return;
        const t = (data ?? []) as TeamTask[]; setList(t); setNames(await loadNames(t.map((x) => x.created_by)));
    }, [userId, today]);
    useEffect(() => { let a = true; Promise.resolve().then(() => { if (a) void load(); }); return () => { a = false; }; }, [load]);
    if (!list.length) return null;
    async function done(t: TeamTask) { await supabase.from('team_tasks').update({ status: 'done' }).eq('id', t.id); await load(); }
    return (
        <section className="rounded-2xl border border-violet-200 bg-white p-4" aria-label="Moje úkoly">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><ListTodo size={16} className="text-violet-700" aria-hidden="true" /> Moje úkoly <Link href="/kancelar/ukoly" className="ml-auto text-sm font-semibold text-indigo-800 hover:underline">Všechny</Link></h2>
            <ul className="mt-2 divide-y divide-slate-100">{list.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="font-semibold text-slate-900">{t.priority === 'high' && <Flag size={12} className="mr-1 inline text-amber-600" aria-label="Spěchá" />}{t.title}</span>
                        <span className="block text-xs text-slate-500">{t.created_by !== userId ? `od ${names[t.created_by] ?? 'kolegy'}` : 'můj úkol'}{t.case_title ? ` · ${t.case_title}` : ''}{!t.seen_at && t.created_by !== userId ? ' · nový' : ''}</span></span>
                    <span className={`text-xs font-semibold ${t.due_date < today ? 'text-rose-700' : t.due_date === today ? 'text-amber-700' : 'text-slate-600'}`}>{t.due_date < today ? 'po termínu' : t.due_date === today ? 'dnes' : new Date(`${t.due_date}T12:00:00`).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })}{t.due_time ? ` ${t.due_time.slice(0, 5)}` : ''}</span>
                    <button type="button" onClick={() => void done(t)} aria-label={`Hotovo: ${t.title}`} className="rounded-lg border border-slate-300 p-1 text-emerald-700 hover:bg-emerald-50 cursor-pointer"><Check size={14} /></button>
                </li>
            ))}</ul>
        </section>
    );
}

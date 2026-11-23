'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CalendarDays, Check, ListTodo, Megaphone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Note = { id: string; kind: string; title: string; link: string; created_at: string; seen_at: string | null };

const ICON: Record<string, typeof Bell> = { task: ListTodo, task_done: Check, task_declined: X, event: CalendarDays, event_moved: CalendarDays, post: Megaphone };
const ago = (iso: string) => {
    const min = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
    return min < 60 ? `před ${min} min` : min < 1440 ? `před ${Math.round(min / 60)} h` : new Date(iso).toLocaleDateString('cs-CZ');
};

// Zvoneček: co mi v kanceláři přišlo (úkol od kolegy, pozvánka do kalendáře, nástěnka). Nové jsou zvýrazněné;
// kliknutím se otevře místo, kde věc je, a upozornění se označí jako přečtené.
export default function NotificationBell({ compact = false }: { compact?: boolean }) {
    const router = useRouter();
    const [items, setItems] = useState<Note[] | null>(null);
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        const { data, error } = await supabase.from('team_notifications').select('id, kind, title, link, created_at, seen_at').order('created_at', { ascending: false }).limit(20);
        setItems(error ? null : (data ?? []) as Note[]);
    }, []);
    useEffect(() => {
        const first = window.setTimeout(() => void load(), 0);
        const id = window.setInterval(() => void load(), 30_000);
        const onFocus = () => void load();
        window.addEventListener('focus', onFocus);
        return () => { window.clearTimeout(first); window.clearInterval(id); window.removeEventListener('focus', onFocus); };
    }, [load]);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    if (items === null) return null; // upozornění ještě nejsou v databázi zapnutá
    const unseen = items.filter((n) => !n.seen_at);

    async function openNote(n: Note) {
        setOpen(false);
        if (!n.seen_at) { setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, seen_at: new Date().toISOString() } : x)) ?? l); await supabase.from('team_notifications').update({ seen_at: new Date().toISOString() }).eq('id', n.id); }
        router.push(n.link);
    }
    async function allSeen() {
        const ids = unseen.map((n) => n.id);
        if (!ids.length) return;
        setItems((l) => l?.map((x) => ({ ...x, seen_at: x.seen_at ?? new Date().toISOString() })) ?? l);
        await supabase.from('team_notifications').update({ seen_at: new Date().toISOString() }).in('id', ids);
    }

    return (
        <div ref={box} className="relative">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-label={unseen.length ? `Upozornění: ${unseen.length} nových` : 'Upozornění'} aria-expanded={open}
                className={`relative rounded-xl ${compact ? 'p-1.5' : 'border border-slate-200 bg-white p-2 shadow-xs'} text-slate-700 hover:bg-slate-100 cursor-pointer`}>
                <Bell size={compact ? 18 : 17} aria-hidden="true" />
                {unseen.length > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[11px] font-bold leading-[18px] text-white">{unseen.length > 9 ? '9+' : unseen.length}</span>}
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" role="dialog" aria-label="Upozornění">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-bold text-slate-900">Upozornění</p>
                        {unseen.length > 0 && <button type="button" onClick={() => void allSeen()} className="text-xs font-semibold text-indigo-800 hover:underline cursor-pointer">Označit vše jako přečtené</button>}
                    </div>
                    {items.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-500">Zatím nic. Až vám kolega zadá úkol, pozve vás do kalendáře nebo vedoucí přidá příspěvek na nástěnku, uvidíte to tady.</p>
                    ) : (
                        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                            {items.map((n) => {
                                const Icon = ICON[n.kind] ?? Bell;
                                return (
                                    <li key={n.id}>
                                        <button type="button" onClick={() => void openNote(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 cursor-pointer ${n.seen_at ? '' : 'bg-indigo-50/60'}`}>
                                            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${n.seen_at ? 'bg-slate-100 text-slate-500' : 'bg-indigo-600 text-white'}`}><Icon size={14} aria-hidden="true" /></span>
                                            <span className="min-w-0 flex-1"><span className={`block text-sm ${n.seen_at ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</span><span className="text-xs text-slate-500">{ago(n.created_at)}</span></span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

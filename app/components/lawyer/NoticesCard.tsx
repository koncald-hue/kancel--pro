'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLawyer } from './LawyerGate';

type Notice = { id: string; title: string; body: string; link: string; created_at: string };

// Zprávy od provozovatele na stránce „Dnes“: zůstávají, dokud je uživatel nepotvrdí
export default function NoticesCard() {
    const { userId } = useLawyer();
    const [items, setItems] = useState<Notice[]>([]);
    useEffect(() => {
        let alive = true;
        (async () => {
            const { data, error } = await supabase.from('admin_notices').select('id, title, body, link, created_at').eq('user_id', userId).is('read_at', null).order('created_at', { ascending: false }).limit(5);
            if (alive && !error) setItems((data ?? []) as Notice[]);
        })().catch(() => undefined);
        return () => { alive = false; };
    }, [userId]);
    async function done(id: string) {
        setItems((l) => l.filter((n) => n.id !== id));
        await supabase.from('admin_notices').update({ read_at: new Date().toISOString() }).eq('id', id);
    }
    if (!items.length) return null;
    return (
        <div className="mb-5 space-y-3" aria-label="Zprávy od Kanceláře Pro">
            {items.map((n) => (
                <section key={n.id} role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900">
                    <div className="flex items-start gap-3">
                        <Bell size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold">{n.title}</p>
                            <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">{n.body}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                {n.link && <Link href={n.link} onClick={() => void done(n.id)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">Otevřít</Link>}
                                <button type="button" onClick={() => void done(n.id)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700 underline"><Check size={13} aria-hidden="true" /> Rozumím</button>
                            </div>
                        </div>
                    </div>
                </section>))}
        </div>
    );
}

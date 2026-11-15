'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Mail, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createCase, BLANK_CASE, loadCases, type LegalCase } from '@/lib/cases';
import type { LawyerClient } from '@/lib/lawyer';
import { ghostBtn, primaryBtn, shortDate } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Inquiry = { id: string; name: string; email: string; phone: string; message: string; status: 'new' | 'accepted' | 'declined'; created_at: string };

export default function LawyerInquiries() {
    const { userId } = useLawyer();
    const [items, setItems] = useState<Inquiry[]>([]);
    const [clients, setClients] = useState<LawyerClient[]>([]);
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [error, setError] = useState('');
    const [accepted, setAccepted] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;
        Promise.all([supabase.from('lawyer_inquiries').select('*').order('created_at', { ascending: false }), supabase.from('lawyer_clients').select('*'), loadCases()])
            .then(([i, c, all]) => { if (cancelled) return; if (i.error) throw new Error(i.error.message); setItems((i.data ?? []) as Inquiry[]); setClients((c.data ?? []) as LawyerClient[]); setCases(all); })
            .catch(() => { if (!cancelled) setError('Poptávky se nepodařilo načíst. Zkontrolujte, že je spuštěné SQL client-portal.sql.'); });
        return () => { cancelled = true; };
    }, []);

    // Střet zájmů: stejný klient nebo e-mail už v kanceláři existuje
    const conflicts = (q: Inquiry) => [
        ...clients.filter((c) => c.name.toLowerCase() === q.name.toLowerCase() || (q.email && c.email.toLowerCase() === q.email.toLowerCase())).map((c) => `klient ${c.name}`),
        ...cases.filter((c) => (c.client_name ?? '').toLowerCase() === q.name.toLowerCase()).map((c) => `věc „${c.title}“`),
    ];

    async function accept(q: Inquiry) {
        try {
            if (!clients.some((c) => c.name.toLowerCase() === q.name.toLowerCase())) {
                const { data } = await supabase.from('lawyer_clients').insert({ user_id: userId, name: q.name, email: q.email, phone: q.phone, note: 'Z poptávky' }).select('*').single();
                if (data) setClients((c) => [...c, data as LawyerClient]);
            }
            const created = await createCase(userId, { ...BLANK_CASE, title: `Věc: ${q.name}`, situation: q.message });
            await supabase.from('cases').update({ client_name: q.name }).eq('id', created.id);
            await supabase.from('lawyer_inquiries').update({ status: 'accepted' }).eq('id', q.id);
            setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'accepted' } : x)));
            setAccepted((a) => ({ ...a, [q.id]: created.id }));
        } catch { setError('Poptávku se nepodařilo přijmout.'); }
    }

    async function decline(q: Inquiry) {
        const { error: err } = await supabase.from('lawyer_inquiries').update({ status: 'declined' }).eq('id', q.id);
        if (err) setError(err.message); else setItems((list) => list.map((x) => (x.id === q.id ? { ...x, status: 'declined' } : x)));
    }

    const fresh = items.filter((i) => i.status === 'new');
    const rest = items.filter((i) => i.status !== 'new');

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {items.length === 0 && !error && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">Zatím žádné poptávky. Odkaz pro zájemce najdete v Nastavení, můžete ho vložit na web nebo do podpisu e-mailu.</p>}
            <ul className="space-y-3">
                {fresh.map((q) => {
                    const clash = conflicts(q);
                    return (
                        <li key={q.id} className="rounded-2xl border border-indigo-200 bg-white p-5">
                            <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-lg font-bold text-slate-900">{q.name}</p><span className="text-xs text-slate-500">{shortDate(new Date(q.created_at))}</span></div>
                            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-indigo-900">{q.email && <a href={`mailto:${q.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail size={14} />{q.email}</a>}{q.phone && <a href={`tel:${q.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={14} />{q.phone}</a>}</p>
                            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{q.message}</p>
                            {clash.length > 0 && <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Možný střet zájmů nebo stávající klient: {clash.join(', ')}.</p>}
                            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void accept(q)} className={primaryBtn}><Check size={16} /> Přijmout jako věc</button><button type="button" onClick={() => void decline(q)} className={ghostBtn}><X size={15} /> Odmítnout</button></div>
                        </li>
                    );
                })}
            </ul>
            {rest.length > 0 && (
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vyřízené</h2>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {rest.map((q) => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-semibold text-slate-800">{q.name}</span><span className="text-xs text-slate-500">{q.status === 'accepted' ? <>přijato{accepted[q.id] && <> · <Link href={`/kancelar/veci/${accepted[q.id]}`} className="font-semibold text-indigo-900 underline">otevřít věc</Link></>}</> : 'odmítnuto'} · {shortDate(new Date(q.created_at))}</span></li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}

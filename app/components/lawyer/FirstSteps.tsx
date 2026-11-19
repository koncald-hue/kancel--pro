'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, Circle, Rocket, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { firstStepsDone, type FirstStep } from '@/lib/firstSteps';
import { useLawyer } from './LawyerGate';

const HIDE_KEY = 'kancelar-prvni-kroky-skryto';
// Na telefonu je průvodce sbalený (nezabírá první obrazovku), na velké obrazovce rozbalený; klepnutím jde přepnout
const subscribeWide = (cb: () => void) => { const mq = window.matchMedia('(min-width: 1024px)'); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); };
const isWide = () => window.matchMedia('(min-width: 1024px)').matches;
const head = { count: 'exact' as const, head: true };

// Průvodce prvními dny: co nastavit, aby Kancelář pracovala za vás. Zmizí, jakmile je vše hotové, nebo ho skryjete.
export default function FirstSteps() {
    const { userId } = useLawyer();
    const [steps, setSteps] = useState<FirstStep[] | null>(null);
    const [hidden, setHidden] = useState(true);
    const wide = useSyncExternalStore(subscribeWide, isWide, () => true);
    const [manual, setManual] = useState<boolean | null>(null);
    const open = manual ?? wide;

    useEffect(() => {
        let show = true;
        try { show = localStorage.getItem(HIDE_KEY) !== '1'; } catch { /* soukromé okno: průvodce ukázat */ }
        if (!show) return;
        const t = window.setTimeout(() => setHidden(false), 0);
        return () => window.clearTimeout(t);
    }, []);
    useEffect(() => {
        if (hidden) return;
        let a = true;
        (async () => {
            const n = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? -1 : (r.count ?? 0); };
            const [clients, cases, mail, isds, tpl, time, team] = await Promise.all([
                n(supabase.from('lawyer_clients').select('id', head)),
                n(supabase.from('cases').select('id', head).eq('user_id', userId)),
                n(supabase.from('mail_accounts').select('id', head)),
                n(supabase.from('isds_accounts').select('id', head)),
                n(supabase.from('case_templates').select('id', head)),
                n(supabase.from('time_entries').select('id', head)),
                supabase.rpc('firm_overview').then(({ data, error }) => { const d = data as { firm?: { role?: string }; members?: unknown[] } | null; return error || d?.firm?.role !== 'owner' ? -1 : (d.members ?? []).length; }),
            ]);
            if (!a) return;
            setSteps([
                { id: 'klient', label: 'Přidejte prvního klienta', hint: 'Nebo nahrajte celý seznam z Excelu či jiného programu.', href: '/kancelar/klienti', alt: ['/kancelar/import', 'Import dat'], done: clients !== 0 },
                { id: 'vec', label: 'Založte první věc', hint: 'Stačí název, třeba „Novák proti Dvořákovi“. Hned se zkontroluje střet zájmů.', href: '/kancelar/veci', done: cases !== 0 },
                { id: 'sablona', label: 'Nastavte úkoly pro nové věci', hint: 'Plná moc, AML, podklady: nová věc je dostane s termíny sama.', href: '/kancelar/sablony', done: tpl !== 0 },
                { id: 'mail', label: 'Připojte e-mail', hint: 'E-maily se navrhnou ke správné věci a uložíte je jedním klepnutím.', href: '/kancelar/email', done: mail !== 0 },
                { id: 'isds', label: 'Připojte datovou schránku', hint: 'Zprávy a lhůty z datovky přímo u věci.', href: '/kancelar/schranka', done: isds !== 0 },
                { id: 'cas', label: 'Zapište první čas', hint: 'Tlačítkem „Zapsat“ nahoře nebo klávesou N, odkudkoli.', done: time !== 0 },
                ...(team >= 0 ? [{ id: 'tym', label: 'Pozvěte kolegy', hint: 'Sdílené věci, chat kanceláře a společné údaje na fakturách.', href: '/kancelar/tym', done: team > 1 }] : []),
            ]);
        })().catch(() => { if (a) setSteps([]); });
        return () => { a = false; };
    }, [hidden, userId]);

    if (hidden || !steps || steps.length === 0 || firstStepsDone(steps)) return null;
    const done = steps.filter((s) => s.done).length;
    function hide() { try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* nic */ } setHidden(true); }

    return (
        <section aria-label="První kroky" className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
            <div className="flex items-start gap-3">
                <span className="rounded-xl bg-indigo-600 p-2 text-white"><Rocket size={18} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-900">Nastavte si Kancelář, ať pracuje za vás</h2>
                    <p className="text-sm text-slate-600">Hotovo {done} z {steps.length}. Každý krok zabere pár minut.</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} /></div>
                </div>
                <button type="button" onClick={() => setManual(!open)} aria-expanded={open} aria-label={open ? 'Sbalit první kroky' : 'Rozbalit první kroky'} title={open ? 'Sbalit' : 'Rozbalit'} className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"><ChevronDown size={16} className={open ? 'rotate-180' : ''} /></button>
                <button type="button" onClick={hide} aria-label="Skrýt první kroky" title="Skrýt" className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"><X size={16} /></button>
            </div>
            {open && <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {steps.map((s) => (
                    <li key={s.id} className={`flex gap-2.5 rounded-xl p-3 ${s.done ? 'bg-white/60' : 'bg-white shadow-xs'}`}>
                        {s.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Hotovo" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-300" aria-label="Zbývá" />}
                        <span className="min-w-0 text-sm">
                            {s.href && !s.done ? <Link href={s.href} className="font-semibold text-indigo-900 hover:underline">{s.label}</Link> : <span className={`font-semibold ${s.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{s.label}</span>}
                            {!s.done && <span className="block text-xs text-slate-600">{s.hint}{s.alt && <> <Link href={s.alt[0]} className="underline">{s.alt[1]}</Link></>}</span>}
                        </span>
                    </li>
                ))}
            </ol>}
        </section>
    );
}

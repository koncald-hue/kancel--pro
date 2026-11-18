'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Eye, Gavel, Landmark, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RADAR_INFO } from '@/lib/radar';
import { syncHlidac } from '@/lib/hlidacSync';
import { EventCard, loadEvents, markSeen, type RadarEvent } from './RadarEvents';
import { ghostBtn, primaryBtn } from '../situation/caseUi';

type Counts = { contacts: number; isir: number | null; katastr: number | null; errors: { case_id: string; label: string; watch_error: string }[] };

async function loadCounts(): Promise<Counts> {
    const [c, i, k, e] = await Promise.all([
        supabase.from('case_contacts').select('id', { count: 'exact', head: true }).eq('watch', true),
        supabase.from('isir_watches').select('id', { count: 'exact', head: true }),
        supabase.from('case_properties').select('id', { count: 'exact', head: true }).eq('watch', true),
        supabase.from('case_properties').select('case_id, label, watch_error').eq('watch', true).neq('watch_error', ''),
    ]);
    return { contacts: c.error ? 0 : c.count ?? 0, isir: i.error ? null : i.count ?? 0, katastr: k.error ? null : k.count ?? 0, errors: e.error ? [] : ((e.data ?? []) as Counts['errors']) };
}

// Hlídač: jedno místo pro to, co se ve vašich věcech změnilo venku (protistrany v ARES a insolvenčním rejstříku, řízení v katastru)
export default function Hlidac() {
    const [events, setEvents] = useState<RadarEvent[] | null | undefined>(undefined);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [counts, setCounts] = useState<Counts | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [kind, setKind] = useState('');
    const reload = useCallback(async () => {
        const list = await loadEvents();
        setEvents(list);
        if (list?.length) {
            const { data } = await supabase.from('cases').select('id, title').in('id', [...new Set(list.map((e) => e.case_id))]);
            setTitles(Object.fromEntries(((data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title])));
        }
        setCounts(await loadCounts());
    }, []);
    useEffect(() => {
        const t = window.setTimeout(() => { void reload().then(() => syncHlidac()).then(() => reload()); }, 0);
        const on = () => void reload();
        window.addEventListener('radar-sync', on);
        return () => { window.clearTimeout(t); window.removeEventListener('radar-sync', on); };
    }, [reload]);
    useEffect(() => { if (events?.length) markSeen(events); }, [events]);

    const shown = useMemo(() => (events ?? []).filter((e) => !kind || e.kind === kind), [events, kind]);
    const kinds = useMemo(() => [...new Set((events ?? []).map((e) => e.kind))], [events]);
    async function check() {
        setBusy(true); setNote('');
        const n = await syncHlidac(true).catch(() => 0);
        await reload(); setBusy(false);
        setNote(n ? `Nalezeno ${n} ${n === 1 ? 'nová změna' : n < 5 ? 'nové změny' : 'nových změn'}.` : 'Zkontrolováno, nic nového.');
    }

    const watchedTotal = (counts?.contacts ?? 0) + (counts?.isir ?? 0) + (counts?.katastr ?? 0);
    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="h-title">
                <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 id="h-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Eye size={18} className="text-indigo-700" aria-hidden="true" /> Hlídač</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">Co se ve vašich věcech změnilo venku: protistrany v obchodním rejstříku (ARES), v insolvenčním rejstříku a řízení v katastru nemovitostí. Aplikace jen upozorní a navrhne další krok, lhůtu i postup potvrzujete vy. Kontroluje se při otevření aplikace, nejvýše jednou za 12 hodin.</p>
                    </div>
                    <button type="button" onClick={() => void check()} disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Zkontrolovat teď</button>
                </div>
                {note && <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{note}</p>}
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Building2 size={13} aria-hidden="true" /> Protistrany (ARES)</dt><dd className="mt-1 text-xl font-bold text-slate-900">{counts?.contacts ?? '–'}</dd><dd className="text-xs text-slate-500">zapnete ve věci v záložce Kontakty</dd></div>
                    <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ShieldAlert size={13} aria-hidden="true" /> Insolvence</dt><dd className="mt-1 text-xl font-bold text-slate-900">{counts?.isir ?? 'nezapnuto'}</dd><dd className="text-xs text-slate-500"><Link href="/kancelar/insolvence" className="font-semibold text-indigo-800 hover:underline">Nastavit hlídání</Link></dd></div>
                    <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Landmark size={13} aria-hidden="true" /> Řízení v katastru</dt><dd className="mt-1 text-xl font-bold text-slate-900">{counts?.katastr ?? 'nezapnuto'}</dd><dd className="text-xs text-slate-500">uložte řízení ve věci (záložka Katastr) a zapněte hlídání</dd></div>
                    <div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Gavel size={13} aria-hidden="true" /> Soudní řízení</dt><dd className="mt-1 text-xl font-bold text-slate-500">ručně</dd><dd className="text-xs text-slate-500">InfoSoud se automaticky nehlídá, <Link href="/kancelar/infosoud" className="font-semibold text-indigo-800 hover:underline">otevřete ho odkazem</Link></dd></div>
                </dl>
                {counts && watchedTotal === 0 && <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">Zatím nic nehlídáte. Ve věci zapněte hlídání u kontaktu protistrany nebo u uloženého řízení v katastru a změny se objeví tady.</p>}
                {counts && counts.errors.length > 0 && <ul className="mt-4 space-y-1 text-xs text-amber-900">{counts.errors.map((e, i) => <li key={i}>Katastr: <Link href={`/kancelar/veci/${e.case_id}?tab=katastr`} className="font-semibold underline">{e.label}</Link>: {e.watch_error}</li>)}</ul>}
            </section>

            {events === undefined ? <p className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Načítám…</p>
                : events === null ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Radar zatím není v databázi zapnutý (chybí spuštění souboru radar.sql).</p>
                    : (
                        <section aria-label="Nevyřízené změny">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Nevyřízené změny ({events.length})</h3>
                                {kinds.length > 1 && <span className="ml-auto flex flex-wrap gap-1.5">{['', ...kinds].map((k) => <button key={k || 'all'} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer ${kind === k ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{k ? RADAR_INFO[k as keyof typeof RADAR_INFO]?.label ?? k : 'Vše'}</button>)}</span>}
                            </div>
                            {shown.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">Žádné nevyřízené změny. Jakmile se u hlídané strany nebo řízení něco změní, uvidíte to tady i na nástěnce.</p>
                                : <ul className="mt-3 space-y-2">{shown.map((e) => <EventCard key={e.id} e={e} caseTitle={titles[e.case_id]} onChanged={() => void reload()} />)}</ul>}
                        </section>
                    )}
            <p className="text-xs text-slate-400">Údaje z rejstříků jsou informativní a nenahrazují úřední výpis. <button type="button" onClick={() => void check()} className={`${ghostBtn} ml-2 py-0.5 text-xs`}>Zkontrolovat znovu</button></p>
        </div>
    );
}

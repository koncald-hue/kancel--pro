'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Check, ExternalLink, Loader2, Radar, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertConfirmedDeadline } from '@/lib/caseFile';
import { RADAR_INFO, suggestDeadline, type RadarKind } from '@/lib/radar';
import { syncHlidac } from '@/lib/hlidacSync';
import { computeAbsolute, czDate } from '@/lib/lhuty';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { safeUrl } from '@/lib/safeUrl';

export type RadarEvent = { id: string; user_id: string; case_id: string; contact_id: string | null; kind: RadarKind; title: string; detail: string; url: string; event_date: string | null; seen: boolean; resolved: boolean; created_at: string };
const TONE = { bad: 'bg-rose-100 text-rose-900', warn: 'bg-amber-100 text-amber-900', info: 'bg-sky-100 text-sky-900' } as const;

// Jedna událost radaru: co se stalo, co doporučujeme a případně návrh lhůty, kterou advokát potvrdí
export function EventCard({ e, caseTitle, onChanged }: { e: RadarEvent; caseTitle?: string; onChanged: () => void }) {
    const info = RADAR_INFO[e.kind];
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    // Insolvence: lhůta od zveřejnění rozhodnutí o úpadku; ostatní: advokát zadá konec lhůty sám
    const plan = info.months ? suggestDeadline(e.kind, date) : (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { ...computeAbsolute(date), title: info.deadlineTitle ?? '' } : null);

    async function resolve() { setBusy(true); await supabase.from('radar_events').update({ resolved: true, seen: true }).eq('id', e.id); setBusy(false); onChanged(); }
    async function addDeadline() {
        if (!plan) return;
        setBusy(true); setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const uid = session?.user.id; if (!uid) throw new Error('Nejste přihlášeni.');
            const basis = `Radar: ${e.title}. ${info.months ? `Lhůta ${info.months} měsíce od zveřejnění rozhodnutí o úpadku (${czDate(date)}), ověřeno advokátem v rozhodnutí.` : 'Konec lhůty zadal advokát.'}`;
            // konec lhůty advokát výslovně zadal / potvrdil v tomto formuláři
            const d = await insertConfirmedDeadline<{ id: string }>({ case_id: e.case_id, user_id: uid, title: plan.title, due_date: plan.end, basis: basis.slice(0, 1500), internal_date: plan.internal });
            await supabase.from('case_entries').insert({ case_id: e.case_id, user_id: uid, kind: 'event', title: `Radar: přidána lhůta ${plan.title}`.slice(0, 200), body: `Konec lhůty ${czDate(plan.end)}${plan.shiftedFrom ? ` (posunuto z ${czDate(plan.shiftedFrom)})` : ''}. ${e.title}`, happened_on: new Date().toISOString().slice(0, 10) });
            await supabase.from('radar_events').update({ resolved: true, seen: true, deadline_id: (d as { id: string }).id }).eq('id', e.id);
            onChanged();
        } catch (ex) { setError(ex instanceof Error ? ex.message : 'Lhůtu se nepodařilo přidat.'); }
        setBusy(false);
    }
    return (
        <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${TONE[info.tone]}`}>{info.label}</span>
                {!e.seen && <span className="rounded-full bg-indigo-800 px-2 py-0.5 text-[11px] font-bold uppercase text-white">Nové</span>}
                <strong className="min-w-0 flex-1 truncate text-slate-900">{e.title}</strong>
                <span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleDateString('cs-CZ')}</span>
            </div>
            {caseTitle && <p className="mt-1 text-xs text-slate-500">Spis: <Link href={`/kancelar/veci/${e.case_id}`} className="font-semibold text-indigo-800 hover:underline">{caseTitle}</Link></p>}
            {e.detail && <p className="mt-1 text-xs text-slate-600">{e.detail}</p>}
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{info.action}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {safeUrl(e.url) && <a href={safeUrl(e.url)} target="_blank" rel="noreferrer noopener" className={ghostBtn}><ExternalLink size={14} /> Otevřít v rejstříku</a>}
                {info.deadlineTitle && <button type="button" onClick={() => setOpen((v) => !v)} className={ghostBtn}><CalendarPlus size={14} /> Navrhnout lhůtu</button>}
                <button type="button" onClick={() => void resolve()} disabled={busy} className={ghostBtn}><Check size={14} /> Vyřízeno</button>
            </div>
            {open && info.deadlineTitle && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                    <label className="block text-xs font-semibold text-slate-600">{info.months ? 'Datum zveřejnění rozhodnutí o úpadku (najdete v rejstříku)' : 'Konec lhůty podle zveřejněné výzvy'}<input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={`${inputCls} mt-1 w-auto font-normal`} /></label>
                    {plan && <p className="text-xs text-slate-700"><strong>{plan.title}</strong>: konec {plan.weekday} {czDate(plan.end)}{plan.shiftedFrom ? ` (posunuto z ${czDate(plan.shiftedFrom)}: ${plan.reasons.join('; ')})` : ''}, doporučený interní termín {czDate(plan.internal)}.</p>}
                    <p className="text-xs text-amber-900">{info.months ? 'Lhůta je stanovena v rozhodnutí o úpadku. Výpočet je jen návrh, před přidáním ji v rozhodnutí ověřte.' : 'Lhůtu ověřte ve zveřejněné výzvě likvidátora.'}</p>
                    <button type="button" onClick={() => void addDeadline()} disabled={!plan || busy} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />} Přidat lhůtu do spisu</button>
                    {error && <p role="alert" className="text-xs text-rose-800">{error}</p>}
                </div>
            )}
        </li>
    );
}

export async function loadEvents(caseId?: string): Promise<RadarEvent[] | null> {
    let q = supabase.from('radar_events').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(30);
    if (caseId) q = q.eq('case_id', caseId);
    const { data, error } = await q;
    if (error) return null;
    return (data ?? []) as RadarEvent[];
}
export const markSeen = (list: RadarEvent[]) => { const ids = list.filter((e) => !e.seen).map((e) => e.id); if (ids.length) void supabase.from('radar_events').update({ seen: true }).in('id', ids).then(() => undefined, () => undefined); };

// Panel na nástěnce: nevyřízené události ze všech věcí; při otevření se sám zkontroluje ARES (nejvýše jednou za 12 hodin)
export function RadarPanel() {
    const [events, setEvents] = useState<RadarEvent[] | null | undefined>(undefined);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [watched, setWatched] = useState(0);
    const [busy, setBusy] = useState(false);
    const reload = useCallback(async () => {
        const list = await loadEvents();
        setEvents(list);
        if (list?.length) {
            const { data } = await supabase.from('cases').select('id, title').in('id', [...new Set(list.map((e) => e.case_id))]);
            setTitles(Object.fromEntries(((data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title])));
        }
        const { count } = await supabase.from('case_contacts').select('id', { count: 'exact', head: true }).eq('watch', true);
        const props = await supabase.from('case_properties').select('id', { count: 'exact', head: true }).eq('watch', true);
        setWatched((count ?? 0) + (props.error ? 0 : props.count ?? 0));
    }, []);
    useEffect(() => {
        const t = window.setTimeout(() => { void reload().then(() => syncHlidac()).then((n) => { if (n) void reload(); }); }, 0);
        const on = () => void reload();
        window.addEventListener('radar-sync', on);
        return () => { window.clearTimeout(t); window.removeEventListener('radar-sync', on); };
    }, [reload]);
    useEffect(() => { if (events?.length) markSeen(events); }, [events]);

    if (events === undefined || events === null) return null;
    if (events.length === 0 && watched === 0) return null;
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Hlídač">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex flex-1 items-center gap-2 text-lg font-bold text-slate-900"><Radar size={18} className="text-indigo-700" aria-hidden="true" /> Hlídač</h2>
                <button type="button" onClick={() => { setBusy(true); void syncHlidac(true).then(() => reload()).finally(() => setBusy(false)); }} disabled={busy} className={ghostBtn}>{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Zkontrolovat teď</button>
            </div>
            {events.length === 0 ? <p className="mt-2 text-sm text-slate-500">Hlídáno {watched} položek (kontakty a řízení v katastru). Nic nového.</p> : <ul className="mt-3 space-y-2">{events.map((e) => <EventCard key={e.id} e={e} caseTitle={titles[e.case_id]} onChanged={() => void reload()} />)}</ul>}
        </section>
    );
}

// Upozornění v detailu věci
export function CaseRadarBanner({ caseId }: { caseId: string }) {
    const [events, setEvents] = useState<RadarEvent[]>([]);
    const reload = useCallback(async () => setEvents((await loadEvents(caseId)) ?? []), [caseId]);
    useEffect(() => { const t = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(t); }, [reload]);
    useEffect(() => { if (events.length) markSeen(events); }, [events]);
    if (!events.length) return null;
    return (
        <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4" aria-label="Radar">
            <p className="flex items-center gap-2 text-sm font-bold text-rose-950"><Radar size={16} aria-hidden="true" /> Radar zjistil {events.length === 1 ? 'událost' : `${events.length} události`} u strany tohoto spisu</p>
            <ul className="mt-2 space-y-2">{events.map((e) => <EventCard key={e.id} e={e} onChanged={() => void reload()} />)}</ul>
        </section>
    );
}

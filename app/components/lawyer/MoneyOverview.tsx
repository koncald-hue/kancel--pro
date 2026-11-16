'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, Clock3, FilePlus2, Percent, Tags } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DUE_SOON_DAYS, loadReceivables, money, round2, type Receivable } from '@/lib/billing';
import { czk, entryAmount, formatMinutes, type TimeEntry } from '@/lib/lawyer';
import { useLawyer } from './LawyerGate';
import ProfitSection from './ProfitSection';

function Tile({ label, value, note, tone, href }: { label: string; value: string; note?: string; tone?: string; href: string }) {
    return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-300 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>{note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}</Link>;
}

// Přehled peněz: co ještě není vyfakturováno, co čeká na zaplacení a rychlé cesty ke kalkulačkám, výkazům a fakturám
export default function MoneyOverview() {
    const { access } = useLawyer();
    const [rows, setRows] = useState<Receivable[] | null>(null);
    const [entries, setEntries] = useState<TimeEntry[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            const [r, e] = await Promise.all([loadReceivables(!!access.vat_payer), supabase.from('time_entries').select('*').eq('billed', false)]);
            if (!alive) return;
            if (e.error) throw new Error(e.error.message);
            setRows(r); setEntries((e.data ?? []) as TimeEntry[]);
        })().catch((err) => { if (alive) { setError(err instanceof Error ? err.message : 'Nepodařilo se načíst.'); setRows([]); setEntries([]); } });
        return () => { alive = false; };
    }, [access.vat_payer]);

    if (rows === null || entries === null) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    const minutes = entries.reduce((s, e) => s + e.minutes, 0);
    const amount = entries.reduce((s, e) => s + entryAmount(e), 0);
    const live = rows.filter((r) => r.state !== 'draft' && r.state !== 'cancelled' && r.state !== 'paid');
    const outstanding = round2(live.reduce((s, r) => s + r.outstanding, 0));
    const overdue = live.filter((r) => r.state === 'overdue');
    const soon = live.filter((r) => r.state === 'due_soon');
    const drafts = rows.filter((r) => r.state === 'draft');

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="K vyfakturování" value={czk(amount)} note={`${formatMinutes(minutes)} h nevyfakturované práce`} href="/kancelar/vykazy" />
                <Tile label="Čeká na zaplacení" value={money(outstanding)} note={`${live.length} vyúčtování`} href="/kancelar/faktury" />
                <Tile label="Po splatnosti" value={money(round2(overdue.reduce((s, r) => s + r.outstanding, 0)))} note={`${overdue.length} vyúčtování`} tone={overdue.length ? 'text-rose-700' : undefined} href="/kancelar/faktury" />
                <Tile label={`Splatnost do ${DUE_SOON_DAYS} dní`} value={money(round2(soon.reduce((s, r) => s + r.outstanding, 0)))} note={`${soon.length} vyúčtování · ${drafts.length} konceptů`} href="/kancelar/faktury" />
            </div>

            <section aria-label="Rychlé akce">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Co teď</h2>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {([
                        ['/kancelar/vykazy', Clock3, 'Zapsat čas', 'Přidejte odpracované hodiny ke věci a klientovi.'],
                        ['/kancelar/faktury', FilePlus2, 'Vyfakturovat', 'Z výkazů práce a ceníku sestavte vyúčtování.'],
                        ['/kancelar/kalkulacky', Calculator, 'Odměna podle tarifu', 'Spočítejte odměnu a náklady řízení a pošlete je do vyúčtování.'],
                        ['/kancelar/kalkulacky', Percent, 'Úrok z prodlení', 'Zákonný úrok s podporou částečných úhrad.'],
                    ] as const).map(([href, Icon, title, text], i) => (
                        <Link key={i} href={href} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-300"><Icon size={18} className="text-indigo-700" aria-hidden="true" /><p className="mt-2 text-sm font-bold text-slate-900">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p></Link>
                    ))}
                </div>
            </section>

            {rows.length > 0 && (
                <section aria-label="Poslední vyúčtování">
                    <div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Poslední vyúčtování</h2><Link href="/kancelar/faktury" className="text-xs font-semibold text-indigo-800 hover:underline">Všechna</Link></div>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                        {rows.slice(0, 6).map((r) => <li key={r.id}><Link href={`/kancelar/faktury/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50"><span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{r.number ?? 'Koncept'}<span className="ml-2 font-normal text-slate-500">{r.client_snapshot.name ?? r.title}</span></span><span className="shrink-0 font-semibold text-slate-800">{money(r.total)}</span></Link></li>)}
                    </ul>
                </section>
            )}
            <ProfitSection />
            <p className="flex items-center gap-1.5 text-xs text-slate-500"><Tags size={12} aria-hidden="true" /> Sazby a služby, které fakturujete nejčastěji, spravujete v <Link href="/kancelar/cenik" className="font-semibold text-indigo-800 underline">Ceníku</Link>.</p>
        </div>
    );
}

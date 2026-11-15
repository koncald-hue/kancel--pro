'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Clock3, FolderOpen, Plus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { collectDeadlines, loadAllDeadlines, type CaseDeadline } from '@/lib/caseFile';
import { daysUntil, loadCases, type LegalCase } from '@/lib/cases';
import { czk, entryAmount, formatMinutes, type TimeEntry } from '@/lib/lawyer';
import { deadlineText, deadlineTone } from '../situation/CaseDeadlinesTab';
import { ghostBtn } from '../situation/caseUi';

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl sm:text-3xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>
            {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
        </div>
    );
}

// Přehled dne: lhůty, otevřené věci a nevyfakturovaná práce
export default function LawyerDashboard() {
    const [data, setData] = useState<{ cases: LegalCase[]; customs: CaseDeadline[]; entries: TimeEntry[]; inquiries: number; unread: number } | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const cases = await loadCases();
            let customs: CaseDeadline[] = [];
            try { customs = await loadAllDeadlines(); } catch { /* lhůty nemusí být zapnuté */ }
            const { data: entries, error: entryError } = await supabase.from('time_entries').select('*').eq('billed', false);
            if (entryError) throw new Error(entryError.message);
            // Poptávky a zprávy klientů: když tabulky ještě nejsou, počítá se nula
            const inquiries = await supabase.from('lawyer_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new');
            const unread = await supabase.from('client_messages').select('id', { count: 'exact', head: true }).eq('from_client', true).eq('read', false);
            if (!cancelled) setData({ cases, customs, entries: (entries ?? []) as TimeEntry[], inquiries: inquiries.count ?? 0, unread: unread.count ?? 0 });
        })().catch(() => { if (!cancelled) setError('Přehled se nepodařilo načíst. Zkontrolujte, že je spuštěné SQL lawyer.sql.'); });
        return () => { cancelled = true; };
    }, []);

    if (error) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>;
    if (!data) return <p className="text-sm text-slate-500" role="status">Načítám přehled…</p>;

    const open = data.cases.filter((c) => c.status === 'open');
    const upcoming = open
        .flatMap((c) => collectDeadlines(c, data.customs.filter((d) => d.case_id === c.id)).filter((d) => !d.done && daysUntil(d.date) >= 0).map((d) => ({ c, d, left: daysUntil(d.date) })))
        .sort((a, b) => a.left - b.left);
    const week = upcoming.filter((u) => u.left <= 7);
    const minutes = data.entries.reduce((s, e) => s + e.minutes, 0);
    const amount = data.entries.reduce((s, e) => s + entryAmount(e), 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Otevřené věci" value={String(open.length)} />
                <Tile label="Lhůty do 7 dní" value={String(week.length)} tone={week.some((w) => w.left <= 2) ? 'text-rose-700' : undefined} note={week[0] ? `nejbližší: ${deadlineText(week[0].left)}` : 'žádná nehrozí'} />
                <Tile label="Nevyfakturováno" value={formatMinutes(minutes)} note="hodin práce" />
                <Tile label="K fakturaci" value={czk(amount)} />
            </div>

            {(data.inquiries > 0 || data.unread > 0) && (
                <div className="flex flex-wrap gap-3">
                    {data.inquiries > 0 && <Link href="/kancelar/poptavky" className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-950 hover:bg-indigo-100">Nové poptávky: {data.inquiries} →</Link>}
                    {data.unread > 0 && <Link href="/kancelar/veci" className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-950 hover:bg-indigo-100">Nepřečtené zprávy od klientů: {data.unread} →</Link>}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Link href="/kancelar/veci" className={ghostBtn}><Plus size={15} /> Nová věc</Link>
                <Link href="/kancelar/klienti" className={ghostBtn}><Users size={15} /> Klient</Link>
                <Link href="/kancelar/vykazy" className={ghostBtn}><Clock3 size={15} /> Zapsat čas</Link>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarClock size={18} className="text-indigo-800" /> Nejbližší lhůty</h2>
                {upcoming.length === 0 ? <p className="mt-3 text-sm text-slate-500">Žádné nadcházející lhůty. Přidejte je ve věcech.</p> : (
                    <ul className="mt-3 divide-y divide-slate-100">
                        {upcoming.slice(0, 8).map(({ c, d, left }) => (
                            <li key={`${c.id}-${d.key}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                                <Link href={`/kancelar/veci/${c.id}`} className="min-w-0 text-slate-800 hover:underline"><span className="font-semibold">{c.title}</span>{c.client_name && <span className="text-slate-500"> · {c.client_name}</span>}<span className="block text-xs text-slate-500">{d.title}</span></Link>
                                <span className={`text-xs font-bold ${deadlineTone(left, false)}`}>{d.date.toLocaleDateString('cs-CZ')} · {deadlineText(left)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {open.length === 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><FolderOpen size={16} className="text-indigo-800" /> Začněte založením první věci v záložce Věci. Ke každé věci patří soubory, lhůty, chronologie a export spisu.</p>
            )}
        </div>
    );
}

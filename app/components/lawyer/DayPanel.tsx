'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Gift } from 'lucide-react';
import { holidayName, isoWeek, nameDay } from '@/lib/nameDays';

const tomorrowOf = (d: Date) => { const t = new Date(d); t.setDate(t.getDate() + 1); return t; };

// Panel „Dnes“: datum, den v týdnu, týden v roce, kdo má svátek a zda je pracovní den
export default function DayPanel({ deadlinesToday = 0 }: { deadlinesToday?: number }) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        // Když se přehodí den (okno nechané přes noc), panel se sám přepne
        const id = window.setInterval(() => setNow((prev) => { const n = new Date(); return n.toDateString() === prev.toDateString() ? prev : n; }), 60_000);
        return () => window.clearInterval(id);
    }, []);

    const weekday = now.toLocaleDateString('cs-CZ', { weekday: 'long' });
    const date = now.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    const holiday = holidayName(now);
    const weekend = now.getDay() === 0 || now.getDay() === 6;
    const status = holiday ? { text: `Státní svátek: ${holiday}`, tone: 'bg-rose-100 text-rose-900' } : weekend ? { text: 'Víkend', tone: 'bg-slate-100 text-slate-700' } : { text: 'Pracovní den', tone: 'bg-emerald-100 text-emerald-900' };
    const tomorrow = tomorrowOf(now);

    return (
        <section aria-label="Dnes" className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-5">
            <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-indigo-800 text-white" aria-hidden="true">
                    <span className="text-[11px] font-bold uppercase leading-none tracking-wider opacity-80">{now.toLocaleDateString('cs-CZ', { month: 'short' })}</span>
                    <span className="text-2xl font-bold leading-tight">{now.getDate()}</span>
                </div>
                <div>
                    <p className="text-xl font-bold capitalize leading-tight text-slate-900">{weekday}</p>
                    <p className="text-sm text-slate-600">{date} · {isoWeek(now)}. týden</p>
                </div>
            </div>
            <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Gift size={13} aria-hidden="true" /> Svátek má</p>
                <p className="text-lg font-bold text-slate-900">{nameDay(now)}</p>
                <p className="text-xs text-slate-500">zítra: {nameDay(tomorrow)}</p>
            </div>
            <div className="ml-auto flex flex-col items-start gap-1.5 sm:items-end">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${status.tone}`}><CalendarDays size={13} aria-hidden="true" /> {status.text}</span>
                <span className="text-xs text-slate-600">{deadlinesToday > 0 ? <strong className="text-rose-800">Dnes končí {deadlinesToday} {deadlinesToday === 1 ? 'lhůta' : deadlinesToday < 5 ? 'lhůty' : 'lhůt'}</strong> : 'Dnes nekončí žádná lhůta'}</span>
            </div>
        </section>
    );
}

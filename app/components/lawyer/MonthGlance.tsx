'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { czk, formatMinutes } from '@/lib/lawyer';
import { changePct, forecast, inMonth, monthEnd, monthOf, monthStart, shiftMonth, sumEntries, type Entry } from '@/lib/mgmt';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Stručný pohled na měsíc na úvodní obrazovce, s odkazem na celý přehled pro vedení
export default function MonthGlance() {
    const [entries, setEntries] = useState<Entry[] | null>(null);
    useEffect(() => {
        let alive = true; const ym = monthOf(todayIso());
        supabase.from('time_entries').select('case_id, entry_date, minutes, rate, billed').gte('entry_date', monthStart(shiftMonth(ym, -1))).lte('entry_date', monthEnd(ym))
            .then(({ data, error }) => { if (alive && !error) setEntries((data ?? []) as Entry[]); });
        return () => { alive = false; };
    }, []);
    if (!entries || entries.length === 0) return null;
    const today = todayIso(); const ym = monthOf(today);
    const cur = sumEntries(inMonth(entries, ym)); const old = sumEntries(inMonth(entries, shiftMonth(ym, -1)));
    const p = changePct(cur.minutes, old.minutes); const fc = forecast(entries, today); const Icon = (p ?? 0) >= 0 ? TrendingUp : TrendingDown;
    return (
        <Link href="/kancelar/vedeni" className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-slate-200 bg-white p-4 text-sm hover:border-indigo-300">
            <span className="font-semibold text-slate-900">Tento měsíc: {formatMinutes(cur.minutes)} · {czk(cur.amount)}</span>
            {p !== null && <span className={`inline-flex items-center gap-1 font-semibold ${p >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}><Icon size={14} aria-hidden="true" /> {p >= 0 ? '+' : ''}{p} % proti minulému</span>}
            <span className="text-slate-600">Prognóza {czk(fc.amount)}{fc.reliable ? '' : ' (hrubě)'}</span>
            <span className="ml-auto text-indigo-900 underline">Přehled pro vedení</span>
        </Link>
    );
}

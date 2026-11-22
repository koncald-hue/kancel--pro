'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildAlerts, type Alert } from '@/lib/attention';
import { entryAmount } from '@/lib/lawyer';
import { todayIso } from '@/lib/billing';
import { DEMO_MARK_LIKE } from '@/lib/demoMarks';

// Na stránce Dnes: rozpočty věcí, které se blíží nebo jsou překročené, a plné moci, které končí. Bez upozornění se nezobrazí nic.
export default function AttentionAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    useEffect(() => {
        let alive = true;
        (async () => {
            const [c, t, p] = await Promise.all([
                supabase.from('cases').select('id, title, budget_czk, budget_warn_pct').not('budget_czk', 'is', null).eq('status', 'open'),
                supabase.from('time_entries').select('case_id, minutes, rate').not('description', 'ilike', DEMO_MARK_LIKE).not('case_id', 'is', null),
                supabase.from('powers_of_attorney').select('id, grantor, case_id, valid_from, valid_to').not('valid_to', 'is', null),
            ]);
            // Dokud migrace 20261119_27 není spuštěná, dotazy selžou a upozornění se jen nezobrazí
            if (!alive || c.error) return;
            const work = (t.data ?? []).map((e) => ({ case_id: e.case_id as string | null, amount: entryAmount({ minutes: Number(e.minutes), rate: Number(e.rate) }) }));
            setAlerts(buildAlerts((c.data ?? []) as never, work, p.error ? [] : ((p.data ?? []) as never), todayIso()));
        })();
        return () => { alive = false; };
    }, []);
    if (alerts.length === 0) return null;
    return (
        <section aria-label="Na co dát pozor" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-amber-950"><AlertTriangle size={15} aria-hidden="true" /> Na co dát pozor</h2>
            <ul className="mt-2 space-y-1.5">
                {alerts.slice(0, 6).map((a) => <li key={a.id}><Link href={a.href} className={`text-sm font-semibold hover:underline ${a.tone === 'bad' ? 'text-rose-800' : 'text-amber-950'}`}>{a.text}</Link></li>)}
                {alerts.length > 6 && <li className="text-xs text-amber-900">a dalších {alerts.length - 6}</li>}
            </ul>
        </section>
    );
}

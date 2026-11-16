'use client';

import { useEffect, useState } from 'react';
import { Building2, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LawyerAccess } from '@/lib/lawyer';
import { ghostBtn } from '../situation/caseUi';

type Firm = { id: string; owner_id: string; name: string; seats: number; until: string | null };
const fmt = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Kanceláře s balíčkem pro správce: okamžité zrušení (členům končí přístup, data zůstávají ke čtení)
export default function AdminFirms({ rows, onDone }: { rows: LawyerAccess[]; onDone: () => void }) {
    const [firms, setFirms] = useState<Firm[] | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [msg, setMsg] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let alive = true;
        Promise.all([supabase.from('firms').select('id, owner_id, name, seats, until').order('created_at', { ascending: false }), supabase.from('firm_members').select('firm_id')]).then(([f, m]) => {
            if (!alive || f.error) return;
            const c: Record<string, number> = {};
            for (const r of (m.data ?? []) as { firm_id: string }[]) c[r.firm_id] = (c[r.firm_id] ?? 0) + 1;
            setCounts(c); setFirms((f.data ?? []) as Firm[]);
        });
        return () => { alive = false; };
    }, [reload]);

    async function cancel(f: Firm) {
        if (!window.confirm(`Zrušit balíček kanceláře „${f.name}“ okamžitě?\n\nVšem členům (${counts[f.id] ?? 0}) hned skončí přístup. Svá data uvidí jen ke čtení, všechny funkce se jim zamknou, dokud nezaplatí.`)) return;
        const { data, error } = await supabase.rpc('staff_cancel_firm_package', { p_firm: f.id });
        setMsg(error ? (/function|schema cache/i.test(error.message) ? 'Chybí spuštění souboru zruseni-a-zamek.sql.' : error.message) : String(data));
        setReload((n) => n + 1); onDone();
    }

    if (!firms || firms.length === 0) return null;
    const today = todayIso();
    return (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Kanceláře s balíčkem">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 size={18} className="text-indigo-700" /> Kanceláře s balíčkem</h2>
            <ul className="mt-3 divide-y divide-slate-100">
                {firms.map((f) => {
                    const active = f.seats > 0 && !!f.until && f.until >= today;
                    const owner = rows.find((r) => r.user_id === f.owner_id);
                    return (
                        <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                            <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{f.name}</p><p className="truncate text-xs text-slate-500">{owner?.email ?? 'vedoucí'} · {counts[f.id] ?? 0} členů{f.seats ? ` z ${f.seats}` : ''} · {active ? `platí do ${fmt(f.until)}` : 'neaktivní'}</p></div>
                            {active && <button type="button" onClick={() => void cancel(f)} className={`${ghostBtn} text-rose-800`}><Ban size={14} /> Zrušit okamžitě</button>}
                        </li>
                    );
                })}
            </ul>
            {msg && <p role="status" className="mt-3 text-sm text-slate-700">{msg}</p>}
        </section>
    );
}

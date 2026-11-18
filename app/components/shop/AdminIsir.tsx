'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { opsLog } from '@/lib/opsLog';
import { PLANS } from '@/lib/plans';
import { czk } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

type Order = { id: string; user_id: string; firm_id: string | null; plan: 'month' | 'half' | 'year'; price_czk: number; status: 'pending' | 'paid' | 'cancelled'; created_at: string };
const KEYS = ['solo', 'firm'] as const;

// Příplatek „Hlídání insolvence“: ceny, objednávky k potvrzení a ruční přidělení
export default function AdminIsir() {
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [orders, setOrders] = useState<Order[]>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const [email, setEmail] = useState('');
    const [months, setMonths] = useState('3');
    const [msg, setMsg] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let alive = true;
        (async () => {
            const [p, o, a] = await Promise.all([supabase.from('app_settings').select('key, value').like('key', 'isir_price_%'), supabase.from('isir_orders').select('*').order('created_at', { ascending: false }).limit(30), supabase.from('lawyer_access').select('user_id, email, display_name')]);
            if (!alive) return;
            if (o.error) { setMsg(/isir_orders|schema cache/i.test(o.error.message) ? 'Chybí spuštění souboru insolvence.sql.' : o.error.message); return; }
            setPrices(Object.fromEntries(((p.data ?? []) as { key: string; value: number }[]).map((r) => [r.key, String(r.value)])));
            setOrders((o.data ?? []) as Order[]);
            setNames(Object.fromEntries(((a.data ?? []) as { user_id: string; email: string; display_name?: string }[]).map((r) => [r.user_id, r.display_name || r.email])));
        })();
        return () => { alive = false; };
    }, [reload]);

    async function save() {
        const rows = KEYS.flatMap((k) => PLANS.map((pl) => [`isir_price_${k}_${pl.id}`, prices[`isir_price_${k}_${pl.id}`] ?? ''])).filter(([, v]) => v !== '').map(([key, v]) => ({ key, value: Number(v) }));
        const { error } = await supabase.from('app_settings').upsert(rows);
        setMsg(error ? error.message : 'Ceny příplatku uloženy.');
    }
    async function confirm(o: Order) {
        if (!await confirmAction('Potvrdit, že platba dorazila? Příplatek se aktivuje na zaplacené období.')) return;
        const { data, error } = await supabase.rpc('staff_confirm_isir_order', { p_order: o.id });
        if (!error) await opsLog('potvrzení platby (insolvence)', o.id, `${o.price_czk} Kč`);
        setMsg(error ? error.message : data === 'ok' ? 'Platba potvrzena, hlídání aktivováno.' : String(data));
        setReload((n) => n + 1);
    }
    async function grant(e: React.FormEvent) {
        e.preventDefault();
        const { data, error } = await supabase.rpc('staff_grant_isir', { p_email: email, p_months: Number(months) || 1 });
        if (!error) await opsLog('přidělení hlídání insolvence', email, `${months} měs.`);
        setMsg(error ? error.message : String(data));
    }

    return (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Hlídání insolvence">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldAlert size={18} className="text-indigo-700" /> Příplatek: hlídání insolvence</h2>
            <p className="mt-1 text-xs text-slate-600">Samostatný advokát platí jen za sebe, kancelář platí jednou a odemkne se všem členům. Nastavené ceny platí pro nové objednávky.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {KEYS.map((k) => (
                    <div key={k} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs font-bold text-slate-700">{k === 'solo' ? 'Samostatný advokát (Kč)' : 'Kancelář, celá (Kč)'}</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">{PLANS.map((pl) => <label key={pl.id} className="text-xs font-semibold text-slate-600">{pl.name}<input value={prices[`isir_price_${k}_${pl.id}`] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [`isir_price_${k}_${pl.id}`]: e.target.value }))} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /></label>)}</div>
                    </div>
                ))}
            </div>
            <button type="button" onClick={() => void save()} className={`${primaryBtn} mt-3`}>Uložit ceny</button>
            <form onSubmit={grant} className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-[14rem] flex-1 text-xs font-semibold text-slate-600">Přidělit bez placení (e-mail)<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1 font-normal`} /></label>
                <label className="w-24 text-xs font-semibold text-slate-600">Měsíců<input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /></label>
                <button type="submit" className={ghostBtn}>Přidělit</button>
            </form>
            {msg && <p role="status" className="mt-3 text-sm text-slate-700">{msg}</p>}
            {orders.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                    {orders.map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                            <span><strong className="text-slate-900">{names[o.user_id] ?? o.user_id.slice(0, 8)}</strong> · {o.firm_id ? 'kancelář' : 'sám'} · {o.plan === 'year' ? 'rok' : o.plan === 'half' ? 'půl roku' : 'měsíc'} · {czk(o.price_czk)}</span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">{o.status === 'pending' ? 'čeká na platbu' : o.status === 'paid' ? 'zaplaceno' : 'zrušeno'}{o.status === 'pending' && <button type="button" onClick={() => void confirm(o)} className={ghostBtn}>Potvrdit platbu</button>}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

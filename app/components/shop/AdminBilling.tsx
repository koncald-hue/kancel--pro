'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { czk, type LawyerAccess } from '@/lib/lawyer';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';

type Order = { id: string; user_id: string; plan: 'month' | 'year'; price_czk: number; status: 'pending' | 'paid' | 'cancelled' | 'refund_due'; provider_ref: string; created_at: string; paid_at: string | null; period_end: string | null };
const LABEL = { pending: 'čeká na platbu', paid: 'zaplaceno', cancelled: 'zrušeno', refund_due: 'VRÁTIT PENÍZE' } as const;

// Ceny předplatného a objednávky advokátů. Platby běžně potvrzuje brána automaticky přes webhook.
export default function AdminBilling({ rows }: { rows: LawyerAccess[] }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [prices, setPrices] = useState({ month: '', year: '' });
    const [msg, setMsg] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [o, p] = await Promise.all([supabase.from('lawyer_orders').select('*').order('created_at', { ascending: false }).limit(50), supabase.from('app_settings').select('key, value').in('key', ['lawyer_price_month', 'lawyer_price_year'])]);
            if (cancelled) return;
            if (o.error) { setMsg('Objednávky nejdou načíst. Je spuštěné SQL verification-billing.sql?'); return; }
            setOrders((o.data ?? []) as Order[]);
            const map = Object.fromEntries(((p.data ?? []) as { key: string; value: number }[]).map((r) => [r.key, String(r.value)]));
            setPrices({ month: map.lawyer_price_month ?? '', year: map.lawyer_price_year ?? '' });
        })();
        return () => { cancelled = true; };
    }, [reload]);

    async function savePrices() {
        const rowsToSave = [['lawyer_price_month', prices.month], ['lawyer_price_year', prices.year]].map(([key, v]) => ({ key, value: Math.max(0, Math.round(Number(v.replace(',', '.')) || 0)) }));
        const { error } = await supabase.from('app_settings').upsert(rowsToSave);
        setMsg(error ? error.message : 'Ceny uloženy. Platí pro nové objednávky.');
    }

    async function markPaid(o: Order) {
        if (!window.confirm('Potvrdit, že platba dorazila? Advokátovi se tím aktivuje přístup na zaplacené období.')) return;
        const { data, error } = await supabase.rpc('staff_mark_order_paid', { p_order: o.id });
        setMsg(error ? error.message : data === 'refund_due' ? 'Advokát není ověřený, platbu je potřeba vrátit.' : 'Platba potvrzena, přístup aktivován.');
        setReload((n) => n + 1);
    }

    const who = (id: string) => rows.find((r) => r.user_id === id)?.email || id.slice(0, 8);

    return (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Předplatné advokátů">
            <h2 className="text-lg font-bold text-slate-900">Předplatné advokátů</h2>
            <p className="mt-1 text-xs text-slate-600">Advokát smí objednat jen po ověření. Zaplacená objednávka mu automaticky aktivuje přístup na dobu předplatného. Pokud by platba dorazila od neověřeného, nikdy se neaktivuje a označí se k vrácení peněz.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-slate-600">Cena za měsíc (Kč)<input value={prices.month} onChange={(e) => setPrices((p) => ({ ...p, month: e.target.value }))} inputMode="numeric" className={`${inputCls} mt-1 w-32 font-normal`} /></label>
                <label className="text-xs font-semibold text-slate-600">Cena za rok (Kč)<input value={prices.year} onChange={(e) => setPrices((p) => ({ ...p, year: e.target.value }))} inputMode="numeric" className={`${inputCls} mt-1 w-32 font-normal`} /></label>
                <button type="button" onClick={() => void savePrices()} className={primaryBtn}>Uložit ceny</button>
            </div>
            {msg && <p role="status" className="mt-3 text-sm text-slate-700">{msg}</p>}
            {orders.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                    {orders.map((o) => (
                        <li key={o.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${o.status === 'refund_due' ? 'bg-rose-50' : ''}`}>
                            <span><strong className="text-slate-900">{who(o.user_id)}</strong> · {o.plan === 'year' ? 'rok' : 'měsíc'} · {czk(o.price_czk)}<span className="block text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('cs-CZ')}{o.period_end && ` · platí do ${new Date(`${o.period_end}T12:00:00`).toLocaleDateString('cs-CZ')}`}{o.provider_ref && ` · ${o.provider_ref}`}</span></span>
                            <span className="flex items-center gap-2"><span className={`text-xs font-bold ${o.status === 'refund_due' ? 'text-rose-700' : o.status === 'paid' ? 'text-emerald-700' : 'text-slate-500'}`}>{LABEL[o.status]}</span>{o.status === 'pending' && <button type="button" onClick={() => void markPaid(o)} className={ghostBtn}>Potvrdit platbu (nouzově)</button>}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

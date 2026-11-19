'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Data = { users: number; paying: number; expiring: number; pendingOrders: number; refunds: number; monthIncome: number | null; firms: number; profileMissing: number; invoicesMissing: number | null };
const kc = (n: number) => `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n)} Kč`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Přehled správy: čísla na první pohled a seznam toho, co je potřeba vyřídit
export default function AdminHome() {
    const [d, setD] = useState<Data | null>(null);
    useEffect(() => {
        let a = true;
        (async () => {
            const today = iso(new Date()); const in14 = iso(new Date(Date.now() + 14 * 86_400_000)); const month = `${today.slice(0, 7)}-01`;
            const [la, lo, io, inv, firms] = await Promise.all([
                supabase.from('lawyer_access').select('status, until, verification_status'),
                supabase.from('lawyer_orders').select('id, status'),
                supabase.from('isir_orders').select('id, status'),
                supabase.from('ops_invoices').select('total, source_ref, issue_date'),
                supabase.from('firms').select('id', { count: 'exact', head: true }),
            ]);
            const rows = (la.data ?? []) as { status: string; until: string | null; verification_status?: string }[];
            const paying = rows.filter((r) => r.status === 'active' && r.until && r.until >= today);
            const orders = [...((lo.data ?? []) as { id: string; status: string }[]), ...((io.data ?? []) as { id: string; status: string }[])];
            const invs = inv.error ? null : (inv.data ?? []) as { total: number; source_ref: string | null; issue_date: string }[];
            const invoiced = new Set((invs ?? []).map((i) => i.source_ref));
            if (a) setD({
                users: rows.length, paying: paying.length, expiring: paying.filter((r) => (r.until ?? '') <= in14).length,
                pendingOrders: orders.filter((o) => o.status === 'pending').length, refunds: orders.filter((o) => o.status === 'refund_due').length,
                monthIncome: invs ? invs.filter((i) => i.issue_date >= month).reduce((s, i) => s + Number(i.total), 0) : null,
                firms: firms.count ?? 0, profileMissing: rows.filter((r) => r.verification_status !== 'verified').length,
                invoicesMissing: invs ? orders.filter((o) => o.status === 'paid' && !invoiced.has(o.id)).length : null,
            });
        })().catch(() => undefined);
        return () => { a = false; };
    }, []);
    if (!d) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    const tile = (label: string, value: string, href: string, note = '') => <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>{note && <p className="text-xs text-slate-500">{note}</p>}</Link>;
    const todo: [string, string][] = [
        ...(d.pendingOrders ? [[`${d.pendingOrders} objednávek čeká na zaplacení nebo potvrzení platby`, '/admin/advokati'] as [string, string]] : []),
        ...(d.refunds ? [[`${d.refunds} objednávek k vrácení peněz (a vystavení dobropisu)`, '/admin/advokati'] as [string, string]] : []),
        ...(d.invoicesMissing ? [[`${d.invoicesMissing} zaplacených objednávek bez faktury: doplňte je v Účetnictví → Faktury`, '/admin/ucetnictvi'] as [string, string]] : []),
        ...(d.expiring ? [[`${d.expiring} předplatných končí do 14 dní`, '/admin/advokati'] as [string, string]] : []),
        ...(d.monthIncome === null ? [['Účetnictví provozovatele zatím není v databázi zapnuté (migrace 20261118_20)', '/admin/ucetnictvi'] as [string, string]] : []),
    ];
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tile('Uživatelé', String(d.users), '/admin/advokati', `${d.profileMissing} bez vyplněného profilu`)}
                {tile('Platící', String(d.paying), '/admin/advokati', `${d.expiring} končí do 14 dní`)}
                {tile('Kanceláře', String(d.firms), '/admin/advokati')}
                {tile('Příjmy tento měsíc', d.monthIncome === null ? '–' : kc(d.monthIncome), '/admin/ucetnictvi')}
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="K vyřízení">
                <h2 className="font-bold text-slate-900">K vyřízení</h2>
                {todo.length === 0 ? <p className="mt-2 text-sm text-emerald-800">Nic nečeká.</p> : <ul className="mt-2 space-y-1.5">{todo.map(([t, h]) => <li key={t}><Link href={h} className="flex items-center gap-2 text-sm text-slate-800 hover:text-indigo-800"><AlertTriangle size={14} className="shrink-0 text-amber-600" aria-hidden="true" />{t}<ArrowRight size={13} aria-hidden="true" /></Link></li>)}</ul>}
            </section>
            <p className="text-xs text-slate-500">Správa vidí uživatele, předplatné, platby a vlastní účetnictví provozovatele. Obsah věcí, souborů a zpráv advokátů nevidí a vidět nemůže.</p>
        </div>
    );
}

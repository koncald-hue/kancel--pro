'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { STATUS_LABELS, computeTotals, money, type Invoice, type InvoiceLine, type InvoiceStatus } from '@/lib/billing';
import { inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const TONE: Record<InvoiceStatus, string> = { draft: 'bg-slate-100 text-slate-700', issued: 'bg-indigo-100 text-indigo-900', paid: 'bg-emerald-100 text-emerald-900', cancelled: 'bg-rose-100 text-rose-900' };
const dateCz = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ') : '–');
const today = () => new Date().toISOString().slice(0, 10);

// Přehled vyúčtování a faktur
export default function LawyerInvoices() {
    const { userId, access } = useLawyer();
    const router = useRouter();
    const [rows, setRows] = useState<(Invoice & { total: number })[] | null>(null);
    const [filter, setFilter] = useState<'all' | InvoiceStatus | 'overdue'>('all');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [inv, lines] = await Promise.all([supabase.from('invoices').select('*').order('created_at', { ascending: false }), supabase.from('invoice_lines').select('invoice_id, qty, unit_price, vat_rate')]);
            if (cancelled) return;
            if (inv.error) { setError(/invoices|relation|does not exist/i.test(inv.error.message) ? 'Fakturace zatím není v databázi zapnutá (chybí spuštění souboru fakturace.sql).' : inv.error.message); setRows([]); return; }
            const byInvoice = new Map<string, Pick<InvoiceLine, 'qty' | 'unit_price' | 'vat_rate'>[]>();
            for (const l of (lines.data ?? []) as (InvoiceLine & { invoice_id: string })[]) byInvoice.set(l.invoice_id, [...(byInvoice.get(l.invoice_id) ?? []), l]);
            setRows(((inv.data ?? []) as Invoice[]).map((i) => ({ ...i, total: computeTotals(byInvoice.get(i.id) ?? [], i.status === 'draft' ? !!access.vat_payer : i.supplier_snapshot.vat_payer === true).total })));
        })();
        return () => { cancelled = true; };
    }, [access.vat_payer]);

    async function create() {
        setBusy(true);
        const { data, error: err } = await supabase.from('invoices').insert({ user_id: userId, issue_date: today() }).select('id').single();
        setBusy(false);
        if (err) { setError(err.message); return; }
        router.push(`/kancelar/faktury/${(data as { id: string }).id}`);
    }

    const overdue = (i: Invoice) => i.status === 'issued' && !!i.due_date && i.due_date < today();
    const shown = (rows ?? []).filter((i) => filter === 'all' || (filter === 'overdue' ? overdue(i) : i.status === filter));
    const outstanding = (rows ?? []).filter((i) => i.status === 'issued').reduce((s, i) => s + i.total, 0);
    const overdueSum = (rows ?? []).filter(overdue).reduce((s, i) => s + i.total, 0);
    const paidSum = (rows ?? []).filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0);

    return (
        <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-3">
                {([['Čeká na zaplacení', money(outstanding), ''], ['Po splatnosti', money(overdueSum), overdueSum > 0 ? 'text-rose-700' : ''], ['Zaplaceno celkem', money(paidSum), '']] as const).map(([label, value, tone]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone || 'text-slate-900'}`}>{value}</p></div>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void create()} disabled={busy} className={primaryBtn}><Plus size={16} /> Nové vyúčtování</button>
                <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={`${inputCls} ml-auto max-w-44`} aria-label="Filtr">
                    <option value="all">Všechna</option><option value="draft">Koncepty</option><option value="issued">Vystavená</option><option value="overdue">Po splatnosti</option><option value="paid">Zaplacená</option><option value="cancelled">Storno</option>
                </select>
            </div>
            {rows === null ? <p className="text-sm text-slate-500" role="status">Načítám…</p> : shown.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{rows.length ? 'Nic neodpovídá filtru.' : 'Zatím žádná vyúčtování. Vytvořte první a vyberte položky z ceníku nebo z výkazů práce.'}</p> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Číslo</th><th className="px-3 py-2.5">Odběratel</th><th className="px-3 py-2.5">Splatnost</th><th className="px-3 py-2.5">Stav</th><th className="px-3 py-2.5 text-right">Částka</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map((i) => (
                                <tr key={i.id} className="hover:bg-indigo-50/40">
                                    <td className="px-4 py-2.5 font-semibold"><Link href={`/kancelar/faktury/${i.id}`} className="text-indigo-800 hover:underline">{i.number ?? 'Koncept'}</Link>{i.title && <span className="block text-xs font-normal text-slate-500">{i.title}</span>}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{i.client_snapshot.name || '–'}</td>
                                    <td className={`px-3 py-2.5 ${overdue(i) ? 'font-bold text-rose-700' : 'text-slate-700'}`}>{dateCz(i.due_date)}</td>
                                    <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${overdue(i) ? 'bg-rose-100 text-rose-900' : TONE[i.status]}`}>{overdue(i) ? 'Po splatnosti' : STATUS_LABELS[i.status]}</span></td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{money(i.total, i.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

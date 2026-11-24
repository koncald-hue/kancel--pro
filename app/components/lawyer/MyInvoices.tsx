'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { czk } from '@/lib/lawyer';
import { invoiceHtml, type OpsInvoice } from '@/lib/opsBooks';
import { useAuth } from '../site/AuthContext';

// Faktury za předplatné: databáze vrací přihlášenému jen jeho vlastní. Bez nich se sekce vůbec nezobrazí.
export default function MyInvoices() {
    const { account } = useAuth();
    const [list, setList] = useState<OpsInvoice[]>([]);
    const [err, setErr] = useState('');
    const id = account?.id;
    useEffect(() => {
        if (!id) return;
        let off = false;
        supabase.from('ops_invoices').select('*').eq('user_id', id).gt('total', 0).order('issue_date', { ascending: false }).then(({ data }) => { if (!off && data) setList(data as OpsInvoice[]); });
        return () => { off = true; };
    }, [id]);
    if (!list.length) return null;
    const open = (i: OpsInvoice) => { const w = window.open('', '_blank'); if (!w) { setErr('Prohlížeč zablokoval nové okno.'); return; } w.document.write(invoiceHtml(i)); w.document.close(); };
    return (
        <section aria-labelledby="my-invoices" className="mx-auto mt-8 max-w-3xl px-4 sm:px-6">
            <h2 id="my-invoices" className="text-lg font-bold text-slate-900">Faktury</h2>
            {err && <p role="alert" className="mt-2 text-sm text-rose-700">{err}</p>}
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {list.map((i) => (
                    <div key={i.id} className="flex flex-col justify-between gap-2 p-4 text-sm sm:flex-row sm:items-center">
                        <div className="min-w-0"><p className="font-semibold text-slate-900">Faktura č. {i.number}</p><p className="truncate text-xs text-slate-500">{i.description} · {new Date(i.issue_date).toLocaleDateString('cs-CZ')}</p></div>
                        <div className="flex shrink-0 items-center gap-3"><span className="font-semibold">{czk(i.total)}</span>
                            <button type="button" onClick={() => open(i)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"><FileText size={14} /> Zobrazit / vytisknout</button></div>
                    </div>
                ))}
            </div>
        </section>
    );
}

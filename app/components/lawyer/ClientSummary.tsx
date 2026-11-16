'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Calculator, Clock3, FilePlus2, Inbox, ShieldAlert, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { money, loadReceivables, round2, type Receivable } from '@/lib/billing';
import { createDraftInvoice } from '@/lib/invoiceDraft';
import { entryAmount, formatMinutes, type LawyerClient, type TimeEntry } from '@/lib/lawyer';
import { useRouter } from 'next/navigation';
import { INS_TONE, insView, loadClientInsolvency, type ClientIns } from '@/lib/clientInsolvency';
import { ghostBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type Data = { cases: LegalCase[]; entries: TimeEntry[]; invoices: Receivable[]; inquiries: number; ins: ClientIns | undefined };

// Souhrn klienta: jeho věci, nevyfakturovaný čas, pohledávky, poptávky a stav v insolvenčním rejstříku (propojené panely na jednom místě)
export default function ClientSummary({ client }: { client: LawyerClient }) {
    const { userId, access } = useLawyer();
    const router = useRouter();
    const [data, setData] = useState<Data | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            const all = await loadCases();
            const cases = all.filter((c) => c.client_id === client.id);
            const ids = cases.map((c) => c.id);
            const [e, inv, q, w] = await Promise.all([
                ids.length ? supabase.from('time_entries').select('*').in('case_id', ids) : Promise.resolve({ data: [] }),
                loadReceivables(!!access.vat_payer).catch(() => [] as Receivable[]),
                supabase.from('lawyer_inquiries').select('id', { count: 'exact', head: true }).or(`email.eq.${client.email || '__none__'},name.ilike.${client.name.replace(/[,()%]/g, ' ')}`),
                loadClientInsolvency(),
            ]);
            if (alive) setData({ cases, entries: (e.data ?? []) as TimeEntry[], invoices: inv.filter((i) => i.client_id === client.id), inquiries: q.count ?? 0, ins: (w ?? []).find((x) => x.client_id === client.id) });
        })().catch(() => { if (alive) setData({ cases: [], entries: [], invoices: [], inquiries: 0, ins: undefined }); });
        return () => { alive = false; };
    }, [client.id, client.ico, client.email, client.name, access.vat_payer]);

    if (!data) return <p className="text-xs text-slate-500" role="status">Načítám souhrn klienta…</p>;
    const open = data.entries.filter((e) => !e.billed);
    const openAmount = round2(open.reduce((s, e) => s + entryAmount(e), 0));
    const live = data.invoices.filter((i) => i.state !== 'draft' && i.state !== 'cancelled' && i.state !== 'paid');
    const outstanding = round2(live.reduce((s, i) => s + i.outstanding, 0));
    const overdue = live.filter((i) => i.state === 'overdue');

    async function invoiceAll() {
        setBusy(true);
        try {
            const first = data?.cases[0];
            const id = await createDraftInvoice({ userId, title: `Vyúčtování – ${client.name}`, caseId: data?.cases.length === 1 ? first?.id : null, clientId: client.id, lines: open.map((e) => ({ description: `${e.description.trim() || 'Právní služby'} (${new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('cs-CZ')})`.slice(0, 500), qty: round2(e.minutes / 60), unit: 'hod', unit_price: e.rate, vat_rate: access.vat_payer ? 21 : 0, time_entry_id: e.id })) });
            router.push(`/kancelar/faktury/${id}`);
        } catch { setBusy(false); }
    }

    const stat = (Icon: typeof Wallet, label: string, value: string, tone?: string) => <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><Icon size={12} aria-hidden="true" /> {label}</p><p className={`mt-0.5 text-base font-bold ${tone ?? 'text-slate-900'}`}>{value}</p></div>;

    return (
        <div className="mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {stat(Briefcase, 'Věcí', String(data.cases.length))}
                {stat(Clock3, 'K vyfakturování', `${money(openAmount)} · ${formatMinutes(open.reduce((s, e) => s + e.minutes, 0))} h`)}
                {stat(Wallet, 'Čeká na zaplacení', money(outstanding), overdue.length ? 'text-rose-700' : undefined)}
                {stat(Inbox, 'Poptávek', String(data.inquiries))}
            </div>
            {data.cases.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">Věci: {data.cases.map((c) => <Link key={c.id} href={`/kancelar/veci/${c.id}`} className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-900 hover:bg-indigo-100">{c.title}</Link>)}</p>}
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void invoiceAll()} disabled={open.length === 0 || busy} className={ghostBtn}><FilePlus2 size={14} /> Vyfakturovat čas klienta</button>
                {overdue[0]?.due_date && <Link href={`/kancelar/kalkulacky?tab=urok&jistina=${overdue[0].outstanding}&splatnost=${overdue[0].due_date}`} className={ghostBtn}><Calculator size={14} /> Úrok z prodlení ({overdue.length} po splatnosti)</Link>}
                {client.ico && <Link href={`/kancelar/insolvence?ic=${client.ico}&name=${encodeURIComponent(client.name)}`} className={ghostBtn}><ShieldAlert size={14} /> Insolvence</Link>}
                {data.ins && (() => { const v = insView(data.ins, /^\d{8}$/.test(client.ico ?? '') || !!client.birth); return <span title={v.detail} className={`rounded-full px-2.5 py-1 text-xs font-bold ${INS_TONE[v.tone]}`}>Insolvence: {v.text}{v.detail && v.tone === 'bad' ? ` (${v.detail})` : ''}</span>; })()}
            </div>
        </div>
    );
}

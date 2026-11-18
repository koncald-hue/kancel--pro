'use client';

import { useState } from 'react';
import { Download, FileArchive } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadReceivables, money, todayIso } from '@/lib/billing';
import { buildExport, presetPeriod, zipFiles, type ExportSummary, type FullInvoice, type PayRow } from '@/lib/accountantExport';
import { useLawyer } from './LawyerGate';

const PRESETS = [['lastmonth', 'Minulý měsíc'], ['month', 'Tento měsíc'], ['lastquarter', 'Minulé čtvrtletí'], ['quarter', 'Toto čtvrtletí'], ['lastyear', 'Minulý rok'], ['year', 'Letošní rok']] as const;

// Podklady pro účetní jedním kliknutím: zvolí se období, vznikne ZIP s tabulkami pro Excel a fakturami ve formátu ISDOC
export default function AccountantExport() {
    const { access } = useLawyer();
    const today = todayIso();
    const [range, setRange] = useState(presetPeriod('lastmonth', today));
    const [isdoc, setIsdoc] = useState(true);
    const [pohoda, setPohoda] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ summary: ExportSummary; warnings: string[]; name: string } | null>(null);

    async function run() {
        setBusy(true); setError(''); setResult(null);
        try {
            if (range.from > range.to) throw new Error('Začátek období je později než jeho konec.');
            const [recv, lines, pays, txs] = await Promise.all([
                loadReceivables(!!access.vat_payer),
                supabase.from('invoice_lines').select('*').order('position'),
                supabase.from('invoice_payments').select('*'),
                supabase.from('bank_transactions').select('payment_id, counterparty').not('payment_id', 'is', null),
            ]);
            if (lines.error) throw new Error(lines.error.message);
            const lineBy = new Map<string, FullInvoice['lines']>();
            for (const l of (lines.data ?? []) as FullInvoice['lines']) lineBy.set(l.invoice_id, [...(lineBy.get(l.invoice_id) ?? []), { ...l, qty: Number(l.qty), unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate) }]);
            const invoices: FullInvoice[] = recv.map((r) => ({ ...r, lines: lineBy.get(r.id) ?? [] }));
            const numberOf = new Map(recv.map((r) => [r.id, r.number ?? '']));
            const who = new Map(((txs.error ? [] : txs.data) as { payment_id: string; counterparty: string }[]).map((t) => [t.payment_id, t.counterparty]));
            const payments: PayRow[] = (pays.error ? [] : (pays.data as PayRow[])).map((p) => ({ ...p, amount: Number(p.amount), invoice_number: numberOf.get(p.invoice_id) ?? '', counterparty: who.get(p.id) ?? '' }));
            const built = buildExport({ invoices, payments, from: range.from, to: range.to, today }, { isdoc, pohoda });
            const blob = await zipFiles(built.files);
            const name = `podklady-pro-ucetni-${range.from}_${range.to}.zip`;
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
            setResult({ summary: built.summary, warnings: built.warnings, name });
        } catch (e) { setError(e instanceof Error ? e.message : 'Export se nepodařil.'); }
        setBusy(false);
    }

    const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
    return (
        <section className="max-w-3xl space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">Podklady pro účetní</h2>
                <p className="mt-1 text-sm text-slate-600">Zvolte období a stáhněte jeden soubor ZIP. Obsahuje přehled vydaných faktur, přijaté platby, souhrn DPH po sazbách, neuhrazené pohledávky a faktury ve formátu ISDOC, který umí načíst Pohoda, Money a další účetní programy.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {PRESETS.map(([k, label]) => <button key={k} type="button" onClick={() => setRange(presetPeriod(k, today))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-indigo-400">{label}</button>)}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold text-slate-700">Od<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={`${input} mt-1 block`} /></label>
                    <label className="text-sm font-semibold text-slate-700">Do<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={`${input} mt-1 block`} /></label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isdoc} onChange={(e) => setIsdoc(e.target.checked)} /> Přidat faktury ve formátu ISDOC</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={pohoda} onChange={(e) => setPohoda(e.target.checked)} /> Přidat soubor pro import do Pohody (XML). Formálně ověřeno proti schématu výrobce, před ostrým importem vyzkoušejte na kopii účetnictví.</label>
                <button type="button" onClick={run} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"><FileArchive size={16} aria-hidden="true" /> {busy ? 'Připravuji…' : 'Stáhnout podklady'}</button>
                {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            </div>
            {result && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
                    <p className="flex items-center gap-2 font-bold"><Download size={16} aria-hidden="true" /> Staženo: {result.name}</p>
                    <p className="mt-2">{result.summary.invoices} vydaných faktur{result.summary.cancelled ? ` (a ${result.summary.cancelled} stornovaných)` : ''}: základ {money(result.summary.base)}, DPH {money(result.summary.vat)}, celkem {money(result.summary.total)}.</p>
                    <p>Přijaté platby: {result.summary.payments}, celkem {money(result.summary.paid)}. Neuhrazeno ke konci období: {money(result.summary.receivables)}.</p>
                    {result.warnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-900">{result.warnings.slice(0, 12).map((w) => <li key={w}>{w}</li>)}</ul>}
                </div>
            )}
            <p className="text-xs text-slate-500">Datum uskutečnění zdanitelného plnění se bere z data vystavení. Tabulky otevřete v Excelu, oddělovač je středník. Konkrétní účetní program (Pohoda, Money) si vždy nejprve vyzkoušejte na jedné faktuře.</p>
        </section>
    );
}

import JSZip from 'jszip';
import { computeTotals, round2, type InvoiceLine, type Payment, type Receivable } from './billing';
import { buildIsdoc } from './isdoc';

// Podklady pro účetní: přehled vydaných faktur, plateb, souhrn DPH po sazbách, pohledávky a faktury ve formátu ISDOC.
export type FullInvoice = Receivable & { lines: InvoiceLine[] };
export type PayRow = Payment & { invoice_number: string; counterparty?: string };
export type ExportInput = { invoices: FullInvoice[]; payments: PayRow[]; from: string; to: string; today: string };
export type ExportSummary = { invoices: number; cancelled: number; base: number; vat: number; total: number; paid: number; payments: number; receivables: number; byRate: { rate: number; base: number; vat: number }[] };
export type ExportFile = { name: string; content: string };

const cell = (v: string | number) => { const s = typeof v === 'number' ? String(v).replace('.', ',') : v; return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const row = (cols: (string | number)[]) => cols.map(cell).join(';');
const dmy = (iso: string | null | undefined) => (iso ? `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}` : '');
export const csvFile = (name: string, head: string[], rows: (string | number)[][]): ExportFile => ({ name, content: `﻿${[row(head), ...rows.map(row)].join('\r\n')}\r\n` });

const inPeriod = (d: string, from: string, to: string) => d >= from && d <= to;
const RATES = [21, 12, 0];
const STATUS: Record<string, string> = { issued: 'vystaveno', paid: 'zaplaceno', cancelled: 'storno' };

export function buildExport(inp: ExportInput, opt: { isdoc: boolean }): { files: ExportFile[]; summary: ExportSummary; warnings: string[] } {
    const warnings: string[] = [];
    const inv = inp.invoices.filter((i) => i.status !== 'draft' && i.number && inPeriod(i.issue_date, inp.from, inp.to)).sort((a, b) => a.issue_date.localeCompare(b.issue_date) || (a.number ?? '').localeCompare(b.number ?? ''));
    const live = inv.filter((i) => i.status !== 'cancelled');
    const totalsOf = (i: FullInvoice) => computeTotals(i.lines, i.supplier_snapshot.vat_payer === true);

    const head = ['Číslo', 'Variabilní symbol', 'Datum vystavení', 'DUZP', 'Splatnost', 'Odběratel', 'IČO', 'DIČ', 'Adresa', 'Měna', 'Základ 21 %', 'DPH 21 %', 'Základ 12 %', 'DPH 12 %', 'Základ 0 %', 'Základ jiná sazba', 'DPH jiná sazba', 'Celkem', 'Zaplaceno', 'Datum poslední úhrady', 'Stav', 'Název'];
    const lastPaid = (id: string) => inp.payments.filter((p) => p.invoice_id === id).map((p) => p.paid_on).sort().pop() ?? '';
    const invRows = inv.map((i) => {
        const t = totalsOf(i); const g = (r: number) => t.groups.find((x) => x.rate === r);
        const other = t.groups.filter((x) => !RATES.includes(x.rate));
        const sign = i.status === 'cancelled' ? 0 : 1;
        return [i.number ?? '', (i.number ?? '').replace(/\D/g, ''), dmy(i.issue_date), dmy(i.issue_date), dmy(i.due_date), i.client_snapshot.name ?? '', i.client_snapshot.ico ?? '', i.client_snapshot.dic ?? '', i.client_snapshot.address ?? '', i.currency, ...RATES.flatMap((r) => (r === 0 ? [(g(0)?.base ?? 0) * sign] : [(g(r)?.base ?? 0) * sign, (g(r)?.vat ?? 0) * sign])), round2(other.reduce((s, x) => s + x.base, 0) * sign), round2(other.reduce((s, x) => s + x.vat, 0) * sign), t.total * sign, i.paid, dmy(lastPaid(i.id)), STATUS[i.status] ?? i.status, i.title];
    });
    // Pořadí sloupců: základ 21, DPH 21, základ 12, DPH 12, základ 0
    const files: ExportFile[] = [csvFile('vydane-faktury.csv', head, invRows)];

    // Souhrn DPH po sazbách (bez storna; cizí měny jen v seznamu faktur, ne v součtu)
    const czk = live.filter((i) => i.currency === 'CZK');
    if (live.length !== czk.length) warnings.push(`${live.length - czk.length} faktur v EUR je jen v přehledu faktur, do souhrnu DPH v korunách se nezapočítaly.`);
    const rateMap = new Map<number, { base: number; vat: number }>();
    for (const i of czk) for (const g of totalsOf(i).groups) { const c = rateMap.get(g.rate) ?? { base: 0, vat: 0 }; rateMap.set(g.rate, { base: round2(c.base + g.base), vat: round2(c.vat + g.vat) }); }
    const byRate = [...rateMap.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({ rate, ...v }));
    files.push(csvFile('dph-souhrn.csv', ['Sazba DPH', 'Základ', 'DPH', 'Celkem'], [...byRate.map((g) => [`${g.rate} %`, g.base, g.vat, round2(g.base + g.vat)]), ['Celkem', round2(byRate.reduce((s, g) => s + g.base, 0)), round2(byRate.reduce((s, g) => s + g.vat, 0)), round2(byRate.reduce((s, g) => s + g.base + g.vat, 0))]]));

    const pays = inp.payments.filter((p) => inPeriod(p.paid_on, inp.from, inp.to)).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
    files.push(csvFile('platby.csv', ['Datum úhrady', 'Faktura', 'Částka', 'Protistrana', 'Poznámka'], pays.map((p) => [dmy(p.paid_on), p.invoice_number, p.amount, p.counterparty ?? '', p.note])));

    const open = inp.invoices.filter((i) => i.status === 'issued' && i.number && i.issue_date <= inp.to).map((i) => ({ i, left: round2(totalsOf(i).total - inp.payments.filter((p) => p.invoice_id === i.id && p.paid_on <= inp.to).reduce((s, p) => s + p.amount, 0)) })).filter((x) => x.left > 0.004);
    files.push(csvFile('pohledavky.csv', ['Číslo', 'Odběratel', 'Datum vystavení', 'Splatnost', 'Měna', 'Zbývá uhradit', `Dní po splatnosti k ${dmy(inp.to)}`], open.map(({ i, left }) => [i.number ?? '', i.client_snapshot.name ?? '', dmy(i.issue_date), dmy(i.due_date), i.currency, left, i.due_date && i.due_date < inp.to ? Math.round((Date.parse(`${inp.to}T12:00:00Z`) - Date.parse(`${i.due_date}T12:00:00Z`)) / 86_400_000) : 0])));

    let isdocCount = 0;
    if (opt.isdoc) for (const i of live) {
        const r = buildIsdoc(i, i.lines, i.id);
        if (!r) { if (i.currency !== 'CZK') warnings.push(`${i.number}: faktura v ${i.currency} není v ISDOC (je v přehledu faktur).`); continue; }
        warnings.push(...r.warnings);
        files.push({ name: `isdoc/${(i.number ?? i.id).replace(/[^\w.-]+/g, '_')}.isdoc`, content: r.xml }); isdocCount += 1;
    }
    const drafts = inp.invoices.filter((i) => i.status === 'draft' && inPeriod(i.issue_date, inp.from, inp.to)).length;
    if (drafts) warnings.push(`${drafts} konceptů vyúčtování v období není vystavených, do exportu nepatří.`);
    const noVat = live.filter((i) => i.supplier_snapshot.vat_payer !== true).length;
    if (noVat && noVat !== live.length) warnings.push('Část vyúčtování byla vystavena jako od neplátce DPH, část jako od plátce. Zkontrolujte, zda stav plátcovství odpovídá období.');

    const summary: ExportSummary = { invoices: live.length, cancelled: inv.length - live.length, base: round2(byRate.reduce((s, g) => s + g.base, 0)), vat: round2(byRate.reduce((s, g) => s + g.vat, 0)), total: round2(byRate.reduce((s, g) => s + g.base + g.vat, 0)), paid: round2(pays.reduce((s, p) => s + p.amount, 0)), payments: pays.length, receivables: round2(open.reduce((s, x) => s + x.left, 0)), byRate };
    const readme = [`Podklady pro účetní, vydané ${dmy(inp.today)}`, `Období (podle data vystavení): ${dmy(inp.from)} až ${dmy(inp.to)}`, '', 'Soubory:', '- vydane-faktury.csv: všechny vystavené faktury v období (storno s nulovými částkami)', '- dph-souhrn.csv: základ a DPH po sazbách, bez storna, jen koruny', '- platby.csv: platby přijaté v období (datum úhrady)', `- pohledavky.csv: neuhrazené faktury ke dni ${dmy(inp.to)}`, opt.isdoc ? `- isdoc/: ${isdocCount} faktur ve formátu ISDOC 6.0.2 (import do Pohody, Money, Helios a dalších)` : '', '', 'Poznámky:', '- Datum uskutečnění zdanitelného plnění (DUZP) se bere z data vystavení, aplikace jej neeviduje zvlášť. Zkontrolujte, zda to u vašich služeb platí.', '- Částky v CSV mají desetinnou čárku a jsou určené pro Excel v českém prostředí.', `- Kontrolní součty: ${summary.invoices} faktur, základ ${summary.base}, DPH ${summary.vat}, celkem ${summary.total}; přijaté platby ${summary.paid}.`, ...(warnings.length ? ['', 'Upozornění:', ...warnings.map((w) => `- ${w}`)] : [])].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\r\n');
    files.push({ name: 'README.txt', content: `﻿${readme}` });
    return { files, summary, warnings };
}

export async function zipFiles(files: ExportFile[]): Promise<Blob> {
    const zip = new JSZip();
    for (const f of files) zip.file(f.name, f.content);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// Období: tento a minulý měsíc, čtvrtletí, rok
export function presetPeriod(kind: 'month' | 'lastmonth' | 'quarter' | 'lastquarter' | 'year' | 'lastyear', today: string): { from: string; to: string } {
    const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7));
    const last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const iso = (yy: number, mm: number, dd: number) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    if (kind === 'month') return { from: iso(y, m, 1), to: iso(y, m, last(y, m)) };
    if (kind === 'lastmonth') { const yy = m === 1 ? y - 1 : y; const mm = m === 1 ? 12 : m - 1; return { from: iso(yy, mm, 1), to: iso(yy, mm, last(yy, mm)) }; }
    const q = Math.floor((m - 1) / 3);
    if (kind === 'quarter') return { from: iso(y, q * 3 + 1, 1), to: iso(y, q * 3 + 3, last(y, q * 3 + 3)) };
    if (kind === 'lastquarter') { const yy = q === 0 ? y - 1 : y; const qq = q === 0 ? 3 : q - 1; return { from: iso(yy, qq * 3 + 1, 1), to: iso(yy, qq * 3 + 3, last(yy, qq * 3 + 3)) }; }
    if (kind === 'year') return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) };
}

import { supabase } from './supabase';

export type PriceKind = 'sluzba' | 'produkt' | 'vydaj';
export type PriceItem = { id: string; name: string; description: string; kind: PriceKind; unit: string; unit_price: number; vat_rate: number; active: boolean };
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';
export type Invoice = {
    id: string; client_id: string | null; case_id: string | null; number: string | null; title: string; issue_date: string; due_date: string | null;
    status: InvoiceStatus; paid_at: string | null; note: string; currency: 'CZK' | 'EUR'; supplier_snapshot: Party; client_snapshot: Party; created_at: string;
};
export type Party = { name?: string; firm?: string; address?: string; ico?: string; dic?: string; vat_payer?: boolean; bank_account?: string; email?: string; phone?: string; web?: string; note?: string; bar_number?: string };
export type InvoiceLine = { id: string; invoice_id: string; position: number; description: string; qty: number; unit: string; unit_price: number; vat_rate: number; price_item_id: string | null; time_entry_id: string | null };
export type DraftLine = Pick<InvoiceLine, 'description' | 'qty' | 'unit' | 'unit_price' | 'vat_rate'>;

export const KIND_LABELS: Record<PriceKind, string> = { sluzba: 'Služba', produkt: 'Produkt', vydaj: 'Výdaj' };
export const UNITS = ['hod', 'ks', 'úkon', 'paušál', 'strana', 'km', 'den'];
export const VAT_RATES = [21, 12, 0];
export const STATUS_LABELS: Record<InvoiceStatus, string> = { draft: 'Koncept', issued: 'Vystaveno', paid: 'Zaplaceno', cancelled: 'Storno' };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const lineBase = (l: Pick<DraftLine, 'qty' | 'unit_price'>) => round2(l.qty * l.unit_price);

export type Totals = { base: number; vat: number; total: number; groups: { rate: number; base: number; vat: number }[] };

// DPH se počítá ze základu každé sazby zvlášť (zaokrouhleno na haléře). Neplátce DPH DPH nezapočítává.
export function computeTotals(lines: Pick<DraftLine, 'qty' | 'unit_price' | 'vat_rate'>[], vatPayer: boolean): Totals {
    const byRate = new Map<number, number>();
    for (const l of lines) byRate.set(vatPayer ? l.vat_rate : 0, round2((byRate.get(vatPayer ? l.vat_rate : 0) ?? 0) + lineBase(l)));
    const groups = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, base]) => ({ rate, base, vat: round2((base * rate) / 100) }));
    const base = round2(groups.reduce((s, g) => s + g.base, 0));
    const vat = round2(groups.reduce((s, g) => s + g.vat, 0));
    return { base, vat, total: round2(base + vat), groups };
}

export const money = (n: number, currency: 'CZK' | 'EUR' = 'CZK') => `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency === 'EUR' ? '€' : 'Kč'}`;
export const qtyText = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 3 }).format(n);

// Čísla z textových polí: „1 500,50“ → 1500.5 (nebo null)
export function parseAmount(input: string): number | null {
    const text = input.trim().replace(/\s/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
}

// Výkaz práce → položka vyúčtování (hodiny na dvě desetinná místa)
export function lineFromTimeEntry(e: { minutes: number; rate: number; description: string; entry_date: string }, vatRate: number): DraftLine {
    const dateText = new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('cs-CZ');
    return { description: `${e.description.trim() || 'Právní služby'} (${dateText})`.slice(0, 500), qty: round2(e.minutes / 60), unit: 'hod', unit_price: e.rate, vat_rate: vatRate };
}

export const lineFromPriceItem = (p: PriceItem, qty = 1): DraftLine => ({ description: p.description ? `${p.name}: ${p.description}`.slice(0, 500) : p.name, qty, unit: p.unit, unit_price: p.unit_price, vat_rate: p.vat_rate });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dateCz = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('cs-CZ') : '');

function partyHtml(title: string, p: Party): string {
    const rows = [p.name && `<b>${esc(p.name)}</b>`, p.firm && esc(p.firm), p.address && esc(p.address), p.ico && `IČO: ${esc(p.ico)}`, p.dic && `DIČ: ${esc(p.dic)}`, p.email && esc(p.email), p.phone && esc(p.phone)].filter(Boolean);
    return `<div class="party"><h3>${title}</h3><p>${rows.join('<br>')}</p></div>`;
}

// Tisknutelný doklad (otevře se v novém okně a vytiskne / uloží jako PDF)
export function buildInvoiceHtml(inv: Invoice, lines: DraftLine[], totals: Totals, vatPayer: boolean, qr?: { svg: string; amount: number }): string {
    const supplier = inv.supplier_snapshot;
    const vs = (inv.number ?? '').replace(/\D/g, '');
    const rows = lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="r">${qtyText(l.qty)} ${esc(l.unit)}</td><td class="r">${money(l.unit_price, inv.currency)}</td>${vatPayer ? `<td class="r">${l.vat_rate} %</td>` : ''}<td class="r">${money(lineBase(l), inv.currency)}</td></tr>`).join('');
    const groups = vatPayer ? totals.groups.map((g) => `<tr><td colspan="2">Základ ${g.rate} %: ${money(g.base, inv.currency)}</td><td colspan="2" class="r">DPH ${g.rate} %: ${money(g.vat, inv.currency)}</td></tr>`).join('') : '';
    return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${esc(inv.number ? `Faktura ${inv.number}` : 'Vyúčtování (koncept)')}</title><style>
body{font:13px/1.5 system-ui,sans-serif;color:#0f172a;margin:32px}h1{font-size:22px;margin:0}h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 4px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.party p{margin:0}
table{width:100%;border-collapse:collapse;margin-top:8px}th{text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #0f172a;padding:6px 4px}td{padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top}.r{text-align:right;white-space:nowrap}
.total{margin-top:16px;text-align:right;font-size:18px;font-weight:700}.meta{margin-top:16px;color:#334155}small{color:#64748b}@media print{body{margin:12mm}}</style></head><body>
<div class="top"><div><h1>${inv.number ? `Faktura č. ${esc(inv.number)}` : 'Vyúčtování (koncept)'}</h1>${inv.title ? `<p>${esc(inv.title)}</p>` : ''}</div><div class="r"><div>Vystaveno: <b>${dateCz(inv.issue_date)}</b></div><div>Splatnost: <b>${dateCz(inv.due_date) || '–'}</b></div></div></div>
<div class="parties">${partyHtml('Dodavatel', supplier)}${partyHtml('Odběratel', inv.client_snapshot)}</div>
<table><thead><tr><th>Popis</th><th class="r">Množství</th><th class="r">Cena za jednotku</th>${vatPayer ? '<th class="r">DPH</th>' : ''}<th class="r">Základ</th></tr></thead><tbody>${rows}${groups}</tbody></table>
<p class="total">K úhradě: ${money(totals.total, inv.currency)}</p>
${qr ? `<div style="display:flex;align-items:center;gap:14px;margin-top:12px"><div style="width:112px;height:112px">${qr.svg}</div><div><b>QR platba</b><br><small>Naskenujte v aplikaci své banky. Částka ${money(qr.amount, inv.currency)}, variabilní symbol ${vs}.</small></div></div>` : ''}
<div class="meta">${supplier.bank_account ? `Číslo účtu: <b>${esc(supplier.bank_account)}</b>${vs ? ` · variabilní symbol: <b>${vs}</b>` : ''}<br>` : ''}${vatPayer ? '' : '<small>Dodavatel není plátcem DPH.</small><br>'}${inv.note ? `${esc(inv.note)}<br>` : ''}${supplier.note ? esc(supplier.note) : ''}</div>
<p><small>Doklad vyhotoven v aplikaci Kancelář. Za správnost údajů a splnění náležitostí účetního a daňového dokladu odpovídá vystavovatel.</small></p></body></html>`;
}

export function openPrint(html: string): boolean {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(html); w.document.close(); w.focus(); w.print();
    return true;
}

export async function loadPriceItems(): Promise<PriceItem[]> {
    const { data, error } = await supabase.from('price_items').select('*').order('active', { ascending: false }).order('name');
    if (error) throw new Error(/price_items|relation|does not exist/i.test(error.message) ? 'Ceník zatím není v databázi zapnutý (chybí spuštění souboru fakturace.sql).' : error.message);
    return (data ?? []) as PriceItem[];
}

// ---------- Platby a pohledávky ----------
export type Payment = { id: string; invoice_id: string; amount: number; paid_on: string; note: string };
export const DUE_SOON_DAYS = 7;
export type ReceivableState = 'draft' | 'cancelled' | 'paid' | 'overdue' | 'due_soon' | 'partial' | 'open';
export type Receivable = Invoice & { base: number; total: number; paid: number; outstanding: number; state: ReceivableState; daysToDue: number | null };

export const RECEIVABLE_LABELS: Record<ReceivableState, string> = { draft: 'Koncept', cancelled: 'Storno', paid: 'Zaplaceno', overdue: 'Po splatnosti', due_soon: 'Blíží se splatnost', partial: 'Částečně zaplaceno', open: 'Čeká na zaplacení' };

const dayNumber = (iso: string) => Math.floor(new Date(`${iso}T12:00:00Z`).getTime() / 86_400_000);
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Stav pohledávky podle stavu vyúčtování, zbývající částky a splatnosti
export function receivableState(inv: Pick<Invoice, 'status' | 'due_date'>, total: number, paid: number, today = todayIso()): { state: ReceivableState; daysToDue: number | null } {
    const daysToDue = inv.due_date ? dayNumber(inv.due_date) - dayNumber(today) : null;
    if (inv.status === 'draft') return { state: 'draft', daysToDue };
    if (inv.status === 'cancelled') return { state: 'cancelled', daysToDue };
    if (inv.status === 'paid' || round2(total - paid) <= 0) return { state: 'paid', daysToDue };
    if (daysToDue !== null && daysToDue < 0) return { state: 'overdue', daysToDue };
    if (daysToDue !== null && daysToDue <= DUE_SOON_DAYS) return { state: 'due_soon', daysToDue };
    return { state: paid > 0 ? 'partial' : 'open', daysToDue };
}

// Všechna vyúčtování s částkami, zaplaceno a zbývá (pro přehledy a nástěnku)
export async function loadReceivables(vatPayerNow: boolean): Promise<Receivable[]> {
    const [inv, lines, pays] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('invoice_lines').select('invoice_id, qty, unit_price, vat_rate'),
        supabase.from('invoice_payments').select('invoice_id, amount'),
    ]);
    if (inv.error) throw new Error(/invoices|relation|does not exist/i.test(inv.error.message) ? 'Fakturace zatím není v databázi zapnutá (chybí spuštění souboru fakturace.sql).' : inv.error.message);
    const byInvoice = new Map<string, { qty: number; unit_price: number; vat_rate: number }[]>();
    for (const l of (lines.data ?? []) as { invoice_id: string; qty: number; unit_price: number; vat_rate: number }[]) byInvoice.set(l.invoice_id, [...(byInvoice.get(l.invoice_id) ?? []), { qty: Number(l.qty), unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate) }]);
    const paidBy = new Map<string, number>();
    // Chybějící tabulka plateb (nespuštěné SQL) znamená nulové platby
    if (!pays.error) for (const p of (pays.data ?? []) as { invoice_id: string; amount: number }[]) paidBy.set(p.invoice_id, round2((paidBy.get(p.invoice_id) ?? 0) + Number(p.amount)));
    return ((inv.data ?? []) as Invoice[]).map((i) => {
        const calc = computeTotals(byInvoice.get(i.id) ?? [], i.status === 'draft' ? vatPayerNow : i.supplier_snapshot.vat_payer === true);
        const total = calc.total;
        const paid = i.status === 'paid' && !paidBy.get(i.id) ? total : (paidBy.get(i.id) ?? 0);
        return { ...i, base: calc.base, total, paid, outstanding: round2(total - paid), ...receivableState(i, total, paid) };
    });
}

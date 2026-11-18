// Účetnictví provozovatele: přehled příjmů a výdajů po měsících, kniha vydaných faktur a peněžní deník pro účetní.
// Částky jsou v Kč; u plátce DPH se počítá „shora“ (z konečné ceny), stejně jako ve funkci ops_issue v databázi.
export type OpsInvoice = { id: string; number: string; source: string; issue_date: string; paid_on: string | null; description: string; total: number; base: number; vat: number; vat_rate: number; buyer: { name?: string; ico?: string; dic?: string; address?: string; email?: string }; supplier: { name?: string; ico?: string; dic?: string; address?: string; vat_payer?: boolean; bank_account?: string; email?: string; register_note?: string }; credit_for: string | null; note: string };
export type OpsExpense = { id: string; spent_on: string; supplier: string; description: string; category: string; total: number; vat: number; doc_no: string };
export const SOURCE_LABEL: Record<string, string> = { predplatne: 'Předplatné', insolvence: 'Hlídání insolvence', eshop: 'E-shop', rucne: 'Ruční', dobropis: 'Dobropis' };
export const CATEGORY_LABEL: Record<string, string> = { hosting: 'Hosting a servery', software: 'Software a služby', marketing: 'Marketing', pravni: 'Právní služby', ucetni: 'Účetnictví', bankovni: 'Bankovní poplatky', ostatni: 'Ostatní' };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function splitVat(total: number, rate: number, vatPayer: boolean): { base: number; vat: number } {
    if (!vatPayer || !rate) return { base: round2(total), vat: 0 };
    const base = round2(total / (1 + rate / 100));
    return { base, vat: round2(total - base) };
}

export type MonthRow = { month: string; income: number; incomeBase: number; outVat: number; invoices: number; expenses: number; expensesBase: number; inVat: number; profit: number; vatDue: number };
export function monthly(invoices: Pick<OpsInvoice, 'issue_date' | 'total' | 'base' | 'vat'>[], expenses: Pick<OpsExpense, 'spent_on' | 'total' | 'vat'>[]): MonthRow[] {
    const m = new Map<string, MonthRow>();
    const row = (k: string) => { let r = m.get(k); if (!r) { r = { month: k, income: 0, incomeBase: 0, outVat: 0, invoices: 0, expenses: 0, expensesBase: 0, inVat: 0, profit: 0, vatDue: 0 }; m.set(k, r); } return r; };
    for (const i of invoices) { const r = row(i.issue_date.slice(0, 7)); r.income += Number(i.total); r.incomeBase += Number(i.base); r.outVat += Number(i.vat); r.invoices += 1; }
    for (const e of expenses) { const r = row(e.spent_on.slice(0, 7)); r.expenses += Number(e.total); r.expensesBase += Number(e.total) - Number(e.vat); r.inVat += Number(e.vat); }
    return [...m.values()].map((r) => ({ ...r, income: round2(r.income), incomeBase: round2(r.incomeBase), outVat: round2(r.outVat), expenses: round2(r.expenses), expensesBase: round2(r.expensesBase), inVat: round2(r.inVat), profit: round2(r.incomeBase - r.expensesBase), vatDue: round2(r.outVat - r.inVat) })).sort((a, b) => b.month.localeCompare(a.month));
}

const q = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const num = (n: number) => round2(n).toFixed(2).replace('.', ',');
const dmy = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}` : '');
const csv = (head: string[], rows: string[][]) => '﻿' + [head.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n') + '\r\n';

export const invoicesCsv = (list: OpsInvoice[]) => csv(['Číslo', 'Datum vystavení', 'Uhrazeno', 'Zdroj', 'Odběratel', 'IČO', 'DIČ', 'Popis', 'Základ', 'Sazba DPH', 'DPH', 'Celkem'],
    [...list].sort((a, b) => a.number.localeCompare(b.number)).map((i) => [i.number, dmy(i.issue_date), dmy(i.paid_on), SOURCE_LABEL[i.source] ?? i.source, q(i.buyer.name ?? ''), i.buyer.ico ?? '', i.buyer.dic ?? '', q(i.description), num(i.base), String(i.vat_rate), num(i.vat), num(i.total)]));
export const expensesCsv = (list: OpsExpense[]) => csv(['Datum', 'Doklad', 'Dodavatel', 'Popis', 'Kategorie', 'Základ', 'DPH', 'Celkem'],
    [...list].sort((a, b) => a.spent_on.localeCompare(b.spent_on)).map((e) => [dmy(e.spent_on), q(e.doc_no), q(e.supplier), q(e.description), CATEGORY_LABEL[e.category] ?? e.category, num(e.total - e.vat), num(e.vat), num(e.total)]));

// Peněžní deník: příjmy (uhrazené faktury) a výdaje chronologicky s průběžným zůstatkem
export function cashBook(invoices: OpsInvoice[], expenses: OpsExpense[]): { date: string; doc: string; text: string; income: number; expense: number; balance: number }[] {
    const rows = [
        ...invoices.filter((i) => i.paid_on).map((i) => ({ date: i.paid_on as string, doc: i.number, text: `${i.description}${i.buyer.name ? ` – ${i.buyer.name}` : ''}`, income: i.total > 0 ? Number(i.total) : 0, expense: i.total < 0 ? -Number(i.total) : 0 })),
        ...expenses.map((e) => ({ date: e.spent_on, doc: e.doc_no, text: `${e.description}${e.supplier ? ` – ${e.supplier}` : ''}`, income: 0, expense: Number(e.total) })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.doc.localeCompare(b.doc));
    let bal = 0;
    return rows.map((r) => { bal = round2(bal + r.income - r.expense); return { ...r, balance: bal }; });
}
export const cashBookCsv = (rows: ReturnType<typeof cashBook>) => csv(['Datum', 'Doklad', 'Text', 'Příjem', 'Výdej', 'Zůstatek'], rows.map((r) => [dmy(r.date), q(r.doc), q(r.text), r.income ? num(r.income) : '', r.expense ? num(r.expense) : '', num(r.balance)]));

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kc = (n: number) => `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} Kč`;
export function invoiceHtml(i: OpsInvoice): string {
    const s = i.supplier; const b = i.buyer; const credit = i.total < 0;
    const party = (title: string, p: { name?: string; address?: string; ico?: string; dic?: string; email?: string }) => `<div><h3>${title}</h3><p><b>${esc(p.name ?? '')}</b><br>${esc(p.address ?? '')}${p.ico ? `<br>IČO: ${esc(p.ico)}` : ''}${p.dic ? `<br>DIČ: ${esc(p.dic)}` : ''}${p.email ? `<br>${esc(p.email)}` : ''}</p></div>`;
    return `<!doctype html><html lang="cs"><meta charset="utf-8"><title>${credit ? 'Dobropis' : 'Faktura'} ${esc(i.number)}</title><style>body{font:13px/1.5 system-ui,sans-serif;margin:32px;color:#0f172a}h1{font-size:22px;margin:0}h3{font-size:11px;text-transform:uppercase;color:#64748b;margin:0 0 4px}.p{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}table{width:100%;border-collapse:collapse}td,th{padding:6px 4px;border-bottom:1px solid #e2e8f0;text-align:left}.r{text-align:right}.t{font-size:18px;font-weight:700;text-align:right;margin-top:12px}small{color:#64748b}</style>
<h1>${credit ? 'Opravný daňový doklad (dobropis)' : s.vat_payer ? 'Faktura – daňový doklad' : 'Faktura'} č. ${esc(i.number)}</h1><p>Vystaveno: ${dmy(i.issue_date)}${s.vat_payer && !credit ? ` · DUZP: ${dmy(i.issue_date)}` : ''}${i.paid_on ? ` · Uhrazeno: ${dmy(i.paid_on)}` : ''}</p>
<div class="p">${party('Dodavatel', s)}${party('Odběratel', b)}</div>
<table><tr><th>Popis</th><th class="r">Základ</th>${s.vat_payer ? '<th class="r">DPH</th>' : ''}<th class="r">Celkem</th></tr><tr><td>${esc(i.description)}</td><td class="r">${kc(i.base)}</td>${s.vat_payer ? `<td class="r">${i.vat_rate} % · ${kc(i.vat)}</td>` : ''}<td class="r">${kc(i.total)}</td></tr></table>
<p class="t">${credit ? 'K vrácení' : 'Celkem'}: ${kc(Math.abs(i.total))}</p>
<p>${i.paid_on && !credit ? 'Zaplaceno, neplaťte.' : ''}${s.bank_account ? ` Účet: ${esc(s.bank_account)}, VS: ${esc(i.number.replace(/\D/g, ''))}.` : ''}</p>
${s.vat_payer ? '' : '<p><small>Dodavatel není plátcem DPH.</small></p>'}${s.register_note ? `<p><small>${esc(s.register_note)}</small></p>` : ''}${i.note ? `<p><small>${esc(i.note)}</small></p>` : ''}</html>`;
}

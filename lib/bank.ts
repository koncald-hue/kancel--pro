// Bankovní pohyby: čtení z Fio API a z CSV výpisu, automatické párování příchozích plateb s vyúčtováním.
export type BankTx = { txid: string; date: string; amount: number; currency: string; vs: string; ks: string; ss: string; counterparty: string; account: string; bankCode: string; message: string; type: string };

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const col = (t: Record<string, unknown>, n: number) => { const c = t[`column${n}`] as { value?: unknown } | null | undefined; return c && typeof c === 'object' ? c.value : undefined; };

const pragueDay = (ms: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
// Datum z Fio: „2026-11-09+0100“ (řetězec) nebo čas v ms
function fioDate(v: unknown): string {
    if (typeof v === 'number') return pragueDay(v);
    const m = str(v).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

// Normalizace odpovědi Fio API (JSON). Pohyby bez datu nebo částky se zahodí.
export function normalizeFio(json: unknown): BankTx[] {
    const list = ((json as { accountStatement?: { transactionList?: { transaction?: unknown } } })?.accountStatement?.transactionList?.transaction ?? []) as Record<string, unknown>[];
    const out: BankTx[] = [];
    for (const t of Array.isArray(list) ? list : []) {
        const id = col(t, 22); const date = fioDate(col(t, 0)); const amount = Number(col(t, 1));
        if (id === undefined || !date || !Number.isFinite(amount) || amount === 0) continue;
        out.push({ txid: `fio:${str(id)}`, date, amount, currency: str(col(t, 14)) || 'CZK', vs: str(col(t, 5)), ks: str(col(t, 4)), ss: str(col(t, 6)), counterparty: str(col(t, 10)) || str(col(t, 9)), account: str(col(t, 2)), bankCode: str(col(t, 3)), message: [str(col(t, 16)), str(col(t, 25)), str(col(t, 18))].filter(Boolean).join(' · '), type: str(col(t, 8)) });
    }
    return out;
}

// ---------- CSV ----------
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function parseCsv(text: string): string[][] {
    const t = text.replace(/^﻿/, '');
    const first = t.split(/\r?\n/, 1)[0] ?? '';
    const delim = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) && first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
    const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (quoted) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; }
        else if (ch === '"') quoted = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c.trim())) rows.push(row); row = []; }
        else cell += ch;
    }
    row.push(cell); if (row.some((c) => c.trim())) rows.push(row);
    return rows;
}

export function parseAmount(raw: string): number | null {
    const s = raw.replace(/\s| /g, '').replace(/^\+/, '');
    if (!/^-?[\d.,]+$/.test(s)) return null;
    const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const n = last >= 0 && s.length - last <= 3 ? Number(`${s.slice(0, last).replace(/[.,]/g, '')}.${s.slice(last + 1)}`) : Number(s.replace(/[.,]/g, ''));
    return Number.isFinite(n) ? n : null;
}

export function parseDateCell(raw: string): string | null {
    const s = raw.trim();
    let m = s.match(/^(\d{1,2})\s*[.\/]\s*(\d{1,2})\s*[.\/]\s*(\d{4})/);
    if (m) { const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { const iso = `${m[1]}-${m[2]}-${m[3]}`; return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null; }
    return null;
}

type Field = 'date' | 'amount' | 'currency' | 'vs' | 'ks' | 'ss' | 'counterparty' | 'account' | 'bankCode' | 'message' | 'txid' | 'type';
const HEADERS: Record<Field, string[]> = {
    date: ['datum', 'datum pohybu', 'datum zauctovani', 'datum transakce', 'date', 'datum splatnosti'],
    amount: ['objem', 'castka', 'objem platby', 'amount', 'castka v mene uctu', 'castka platby'],
    currency: ['mena', 'currency', 'mena uctu'],
    vs: ['vs', 'variabilni symbol', 'variabilni s'],
    ks: ['ks', 'konstantni symbol'], ss: ['ss', 'specificky symbol'],
    counterparty: ['nazev protiuctu', 'protistrana', 'nazev uctu protistrany', 'jmeno protistrany', 'nazev protistrany', 'majitel protiuctu'],
    account: ['protiucet', 'cislo uctu protistrany', 'ucet protistrany', 'cislo protiuctu', 'protiucet cislo'],
    bankCode: ['kod banky', 'kod banky protistrany', 'banka protistrany'],
    message: ['zprava pro prijemce', 'zprava', 'poznamka', 'message', 'poznamka pro prijemce', 'zprava pro platce', 'komentar'],
    txid: ['id pohybu', 'id transakce', 'id', 'id operace', 'reference banky'],
    type: ['typ', 'typ pohybu', 'typ transakce'],
};

export type CsvResult = { txs: BankTx[]; skipped: number; missing: string[]; mapped: Record<string, string> };
export function parseBankCsv(text: string, accountKey = 'csv'): CsvResult {
    const rows = parseCsv(text);
    const headerIdx = rows.findIndex((r) => { const f = r.map(fold); return f.some((h) => HEADERS.date.includes(h)) && f.some((h) => HEADERS.amount.includes(h)); });
    if (headerIdx < 0) return { txs: [], skipped: rows.length, missing: ['datum', 'částka'], mapped: {} };
    const head = rows[headerIdx].map(fold);
    const idx: Partial<Record<Field, number>> = {}; const mapped: Record<string, string> = {};
    for (const f of Object.keys(HEADERS) as Field[]) { const i = head.findIndex((h) => HEADERS[f].includes(h)); if (i >= 0) { idx[f] = i; mapped[f] = rows[headerIdx][i].trim(); } }
    const get = (r: string[], f: Field) => (idx[f] === undefined ? '' : (r[idx[f] as number] ?? '').trim());
    const txs: BankTx[] = []; let skipped = 0; const seen = new Map<string, number>();
    for (const r of rows.slice(headerIdx + 1)) {
        const date = parseDateCell(get(r, 'date')); const amount = parseAmount(get(r, 'amount'));
        if (!date || amount === null || amount === 0) { skipped += 1; continue; }
        const base = { date, amount, currency: get(r, 'currency').toUpperCase() || 'CZK', vs: get(r, 'vs'), ks: get(r, 'ks'), ss: get(r, 'ss'), counterparty: get(r, 'counterparty'), account: get(r, 'account'), bankCode: get(r, 'bankCode'), message: get(r, 'message'), type: get(r, 'type') };
        const given = get(r, 'txid');
        // Bez ID pohybu se použije otisk řádku; shodné řádky ve výpisu dostanou pořadí, aby se nepovažovaly za duplicity
        const sig = `${accountKey}|${date}|${amount}|${base.vs}|${base.account}|${base.message}`;
        const n = (seen.get(sig) ?? 0) + 1; seen.set(sig, n);
        txs.push({ ...base, txid: given ? `${accountKey}:${given}` : `${accountKey}:h${hash(sig)}-${n}` });
    }
    const missing = (['date', 'amount'] as Field[]).filter((f) => idx[f] === undefined);
    return { txs, skipped, missing, mapped };
}
function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

// ---------- Párování ----------
export type OpenInvoice = { id: string; number: string; vs: string; outstanding: number; currency: string; client: string; due: string | null };
export type Decision = { kind: 'auto' | 'suggest' | 'overpay' | 'none'; invoiceId?: string; apply?: number; reason: string; confidence?: 'vs' | 'cislo' | 'castka' };

export const vsOf = (number: string) => number.replace(/\D/g, '');
const stripZeros = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '');
const tokens = (s: string) => fold(s).split(' ').filter((t) => t.length >= 3);

// Příchozí platba proti otevřeným vyúčtováním. Automaticky se páruje jen podle variabilního symbolu; jinak vzniká návrh ke schválení.
export function decide(tx: BankTx, invoices: OpenInvoice[], now = ''): Decision {
    if (tx.amount <= 0) return { kind: 'none', reason: 'Odchozí platba.' };
    const open = invoices.filter((i) => i.outstanding > 0.004);
    const vs = stripZeros(tx.vs);
    const byVs = vs ? open.filter((i) => stripZeros(i.vs) === vs) : [];
    if (byVs.length === 1) {
        const inv = byVs[0];
        if (inv.currency !== tx.currency) return { kind: 'suggest', invoiceId: inv.id, apply: undefined, reason: `Variabilní symbol sedí s ${inv.number}, ale měna je jiná (${tx.currency} místo ${inv.currency}).`, confidence: 'vs' };
        if (tx.amount > inv.outstanding + 0.004) return { kind: 'overpay', invoiceId: inv.id, apply: inv.outstanding, reason: `Variabilní symbol sedí s ${inv.number}, ale platba je o ${(tx.amount - inv.outstanding).toFixed(2)} vyšší než zbývá.`, confidence: 'vs' };
        return { kind: 'auto', invoiceId: inv.id, apply: tx.amount, reason: tx.amount >= inv.outstanding - 0.004 ? `Variabilní symbol ${tx.vs} a částka sedí s ${inv.number}.` : `Variabilní symbol ${tx.vs} sedí s ${inv.number}, částečná úhrada.`, confidence: 'vs' };
    }
    // Číslo vyúčtování ve zprávě pro příjemce
    const inMessage = open.filter((i) => i.number && new RegExp(`(^|\\D)${i.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\D|$)`).test(tx.message));
    if (inMessage.length === 1) { const inv = inMessage[0]; if (inv.currency === tx.currency && tx.amount <= inv.outstanding + 0.004) return { kind: 'auto', invoiceId: inv.id, apply: tx.amount, reason: `Ve zprávě je číslo ${inv.number}.`, confidence: 'cislo' }; return { kind: 'suggest', invoiceId: inv.id, apply: Math.min(tx.amount, inv.outstanding), reason: `Ve zprávě je číslo ${inv.number}.`, confidence: 'cislo' }; }
    // Přesná částka a shoda jména protistrany
    const same = open.filter((i) => i.currency === tx.currency && Math.abs(i.outstanding - tx.amount) < 0.005);
    const named = same.filter((i) => { const a = new Set(tokens(i.client)); return tokens(tx.counterparty).some((t) => a.has(t)); });
    if (named.length === 1) return { kind: 'auto', invoiceId: named[0].id, apply: tx.amount, reason: `Částka a jméno protistrany (${tx.counterparty}) sedí s ${named[0].number}.`, confidence: 'castka' };
    if (same.length === 1 && !vs) return { kind: 'suggest', invoiceId: same[0].id, apply: tx.amount, reason: `Přesná částka sedí jen s ${same[0].number}. Zkontrolujte, zda platba patří k němu.`, confidence: 'castka' };
    void now;
    return { kind: 'none', reason: vs ? `Variabilní symbol ${tx.vs} neodpovídá žádnému neuhrazenému vyúčtování.` : 'Platba nemá variabilní symbol.' };
}

// Dávka: platby od nejstarší, po každém automatickém spárování se sníží zbývající částka (dvě platby ke stejné faktuře)
export function planBatch(txs: BankTx[], invoices: OpenInvoice[]): { tx: BankTx; d: Decision }[] {
    const work = invoices.map((i) => ({ ...i }));
    return [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((tx) => {
        const d = decide(tx, work);
        if (d.kind === 'auto' && d.invoiceId && d.apply) { const inv = work.find((i) => i.id === d.invoiceId); if (inv) inv.outstanding = Math.round((inv.outstanding - d.apply) * 100) / 100; }
        return { tx, d };
    });
}

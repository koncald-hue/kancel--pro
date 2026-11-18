import { fold, parseAnyDate, type Table } from './importer';
import { parseAmount } from './bank';
import { addDays, daysBetween, isIso, vypocetUroku, zakonnaSazba } from './urok';

// Příprava hromadných žalob na elektronický platební rozkaz (EPR). Kancelář NIC nepodává: EPR se podává jen oficiálním formulářem
// v e-Podatelně ministerstva spravedlnosti s kvalifikovaným elektronickým podpisem, bez rozhraní pro hromadné podání.
// Tady se jen načte tabulka pohledávek, zkontrolují se údaje, spočítá se orientační poplatek a úrok a připraví se podklad pro ruční podání.
export type Claim = {
    row: number; debtor: string; address: string; ident: string; invoice: string; note: string;
    amount: number | null; due: string | null;
    interest: number | null; interestRate: number | null; interestDays: number;
    fee: number | null; feeFallback: number | null;
    issues: { level: 'error' | 'warn'; text: string }[];
};

type Field = 'debtor' | 'address' | 'ident' | 'amount' | 'due' | 'invoice' | 'note';
export const EPR_FIELDS: { key: Field; label: string; synonyms: string[] }[] = [
    { key: 'debtor', label: 'Dlužník (jméno nebo název)', synonyms: ['dluznik', 'jmeno', 'jmeno a prijmeni', 'nazev', 'odberatel', 'zalovany', 'klient', 'jmeno dluznika', 'nazev dluznika'] },
    { key: 'address', label: 'Adresa bydliště nebo sídla', synonyms: ['adresa', 'bydliste', 'sidlo', 'trvale bydliste', 'adresa dluznika', 'adresa sidla'] },
    { key: 'ident', label: 'IČO, rodné číslo nebo datum narození', synonyms: ['ico', 'rodne cislo', 'rc', 'datum narozeni', 'narozeni', 'identifikator'] },
    { key: 'amount', label: 'Jistina (Kč)', synonyms: ['jistina', 'castka', 'dluzna castka', 'pohledavka', 'dluh', 'k uhrade', 'neuhrazeno', 'amount'] },
    { key: 'due', label: 'Datum splatnosti', synonyms: ['splatnost', 'datum splatnosti', 'splatne', 'splatnost faktury', 'due'] },
    { key: 'invoice', label: 'Doklad (faktura, smlouva)', synonyms: ['doklad', 'faktura', 'cislo faktury', 'cislo dokladu', 'smlouva', 'variabilni symbol', 'vs'] },
    { key: 'note', label: 'Poznámka', synonyms: ['poznamka', 'popis', 'note', 'duvod'] },
];

export function mapColumns(headers: string[]): Record<Field, number> {
    const f = headers.map(fold); const out = {} as Record<Field, number>; const used = new Set<number>();
    for (const def of EPR_FIELDS) {
        let idx = f.findIndex((h, i) => !used.has(i) && def.synonyms.includes(h));
        if (idx < 0) idx = f.findIndex((h, i) => !used.has(i) && def.synonyms.some((s) => s.length > 3 && h.includes(s)));
        out[def.key] = idx; if (idx >= 0) used.add(idx);
    }
    return out;
}

// Soudní poplatek za návrh na EPR (sazebník, položka 2): 400 Kč do 10 000 Kč, 800 Kč do 20 000 Kč, nad to 4 % z částky.
// Když se EPR nevydá nebo se nepodá oficiální aplikací, platí položka 1 (1 000 Kč do 20 000 Kč, nad to 5 %). Orientační, ověřte v aktuálním znění.
export function eprFee(amount: number): number { return amount <= 10_000 ? 400 : amount <= 20_000 ? 800 : Math.ceil(amount * 0.04); }
export function ordinaryFee(amount: number): number { return amount <= 20_000 ? 1000 : Math.ceil(amount * 0.05); }

export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function buildClaims(table: Table, filing: string): Claim[] {
    const col = mapColumns(table.headers); const get = (r: string[], k: Field) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');
    const seen = new Map<string, number>(); const out: Claim[] = [];
    table.rows.forEach((r, i) => {
        if (r.every((c) => !c.trim())) return;
        const issues: Claim['issues'] = [];
        const debtor = get(r, 'debtor'); const address = get(r, 'address'); const ident = get(r, 'ident'); const invoice = get(r, 'invoice'); const note = get(r, 'note');
        const amount = col.amount >= 0 ? parseAmount(get(r, 'amount')) : null; const due = col.due >= 0 ? parseAnyDate(get(r, 'due')) : null;
        if (!debtor) issues.push({ level: 'error', text: 'Chybí jméno nebo název dlužníka.' });
        if (amount === null || amount <= 0) issues.push({ level: 'error', text: 'Chybí nebo je neplatná jistina.' });
        if (!due) issues.push({ level: 'error', text: 'Chybí nebo je neplatné datum splatnosti.' });
        else if (due >= filing) issues.push({ level: 'error', text: 'Pohledávka ještě není po splatnosti k datu podání.' });
        else if (daysBetween(due, filing) > 3 * 365) issues.push({ level: 'warn', text: 'Splatnost je starší než 3 roky: zvažte promlčení (obecná doba je 3 roky).' });
        if (!address) issues.push({ level: 'warn', text: 'Chybí adresa. Formulář EPR vyžaduje adresu dlužníka (příslušnost soudu a doručování).' });
        if (!ident) issues.push({ level: 'warn', text: 'Chybí IČO, rodné číslo nebo datum narození dlužníka.' });
        const key = `${fold(debtor)}|${fold(invoice)}|${amount}`;
        if (debtor && seen.has(key)) issues.push({ level: 'warn', text: `Vypadá jako duplicita řádku ${seen.get(key)}.` }); else seen.set(key, i + 2);
        let interest: number | null = null, interestRate: number | null = null, interestDays = 0;
        if (amount && amount > 0 && due && isIso(due) && due < filing) {
            const s = zakonnaSazba(due);
            if (s) { const v = vypocetUroku({ jistina: amount, splatnost: due, do: filing, sazbaPct: s.rocni }); interest = v.urok; interestRate = s.rocni; interestDays = v.dnuCelkem; }
            else issues.push({ level: 'warn', text: 'Zákonný úrok z prodlení se nepodařilo spočítat (splatnost před rokem 2014 nebo chybí sazba).' });
        }
        out.push({ row: i + 2, debtor, address, ident, invoice, note, amount: amount ?? null, due, interest, interestRate, interestDays, fee: amount && amount > 0 ? eprFee(amount) : null, feeFallback: amount && amount > 0 ? ordinaryFee(amount) : null, issues });
    });
    return out;
}

export const hasError = (c: Claim) => c.issues.some((x) => x.level === 'error');
export function summary(claims: Claim[]) {
    const ok = claims.filter((c) => !hasError(c));
    return { total: claims.length, ready: ok.length, withError: claims.length - ok.length, withWarn: ok.filter((c) => c.issues.length).length, principal: ok.reduce((s, c) => s + (c.amount ?? 0), 0), interest: ok.reduce((s, c) => s + (c.interest ?? 0), 0), fees: ok.reduce((s, c) => s + (c.fee ?? 0), 0) };
}

const q = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const num = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));
// CSV pro Excel (středník, UTF-8 s BOM): podklad pro ruční vyplnění formuláře
export function claimsCsv(claims: Claim[], filing: string): string {
    const head = ['Řádek', 'Dlužník', 'Adresa', 'IČO / RČ / datum narození', 'Doklad', 'Splatnost', 'Jistina', `Zákonný úrok do ${filing}`, 'Roční sazba %', 'Poplatek EPR', 'Poplatek při zrušení EPR', 'Stav', 'Upozornění'];
    const lines = [head.map(q).join(';')];
    for (const c of claims) lines.push([c.row, c.debtor, c.address, c.ident, c.invoice, c.due ?? '', num(c.amount), num(c.interest), c.interestRate ?? '', c.fee ?? '', c.feeFallback ?? '', hasError(c) ? 'k doplnění' : c.issues.length ? 'zkontrolovat' : 'připraveno', c.issues.map((i) => i.text).join(' ')].map((v) => q(v as string)).join(';'));
    return `﻿${lines.join('\r\n')}\r\n`;
}

// Text jednoho nároku pro rychlé zkopírování do formuláře
export function claimText(c: Claim, filing: string): string {
    const d = (iso: string | null) => (iso ? iso.split('-').reverse().map((x) => String(Number(x))).join('. ') : '');
    return [`Žalovaný: ${c.debtor}`, c.address && `Adresa: ${c.address}`, c.ident && `Identifikace: ${c.ident}`, `Jistina: ${c.amount ?? ''} Kč`, c.due && `Splatnost: ${d(c.due)}`, c.interestRate !== null && `Úrok z prodlení ${c.interestRate} % ročně ode dne ${d(addDays(c.due ?? filing, 1))} do zaplacení (k ${d(filing)} ${num(c.interest)} Kč)`, c.invoice && `Doklad: ${c.invoice}`, c.fee !== null && `Soudní poplatek za návrh na EPR: ${c.fee} Kč`].filter(Boolean).join('\n');
}

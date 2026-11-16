import type { BankTx } from './bank';

// Výpis ve formátu ISO 20022 camt.053 (XML). Tento standardní formát umí exportovat většina českých bank
// (ČSOB, Komerční banka, Česká spořitelna, Raiffeisenbank, Moneta, UniCredit, Fio a další), takže funguje bez napojení na konkrétní banku.
const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const first = (el: Element | undefined, ...path: string[]): Element | undefined => { let cur: Element | undefined = el; for (const p of path) { cur = cur ? kids(cur, p)[0] : undefined; } return cur; };
const text = (el: Element | undefined, ...path: string[]) => (first(el, ...path)?.textContent ?? '').trim();
const desc = (el: Element, name: string): Element[] => Array.from(el.getElementsByTagNameNS('*', name));

// Variabilní symbol: Česká konvence je „VS1234“ nebo „/VS1234/SS…/KS…“ v EndToEndId či zprávě, jinak strukturovaná reference věřitele
function findVs(...sources: string[]): string {
    for (const s of sources) { const m = s.match(/(?:^|[^A-Za-z])VS[:=\s]*0*(\d{1,10})(?!\d)/i); if (m) return m[1]; }
    return '';
}

export function isCamt(text: string): boolean { return /<(?:\w+:)?BkToCstmrStmt\b|<(?:\w+:)?BkToCstmrAcctRptV?/.test(text.slice(0, 5000)); }

export function parseCamt053(xml: string, accountKey = 'csv'): { txs: BankTx[]; skipped: number; iban: string } {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return { txs: [], skipped: 0, iban: '' };
    const txs: BankTx[] = []; let skipped = 0; const seen = new Map<string, number>();
    let iban = '';
    for (const stmt of [...desc(doc.documentElement, 'Stmt'), ...desc(doc.documentElement, 'Rpt')]) {
        const own = text(first(stmt, 'Acct', 'Id'), 'IBAN') || text(first(stmt, 'Acct', 'Id', 'Othr'), 'Id');
        if (!iban) iban = own;
        for (const e of kids(stmt, 'Ntry')) {
            const amtEl = kids(e, 'Amt')[0];
            const amountAbs = Number(amtEl?.textContent);
            const date = text(e, 'BookgDt', 'Dt') || text(e, 'BookgDt', 'DtTm').slice(0, 10) || text(e, 'ValDt', 'Dt');
            const credit = text(e, 'CdtDtInd') === 'CRDT';
            if (!amtEl || !Number.isFinite(amountAbs) || amountAbs === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date.slice(0, 10))) { skipped += 1; continue; }
            if (text(e, 'RvslInd') === 'true') { skipped += 1; continue; }
            const details = desc(e, 'TxDtls');
            const parts = details.length ? details : [e];
            const share = parts.length > 1 && parts.every((p) => text(first(p, 'AmtDtls', 'TxAmt'), 'Amt'));
            for (const d of parts) {
                const each = share ? Number(text(first(d, 'AmtDtls', 'TxAmt'), 'Amt')) : amountAbs;
                if (!Number.isFinite(each) || each === 0) { skipped += 1; continue; }
                const party = first(d, 'RltdPties');
                const who = text(party, credit ? 'Dbtr' : 'Cdtr', 'Nm') || text(party, credit ? 'Dbtr' : 'Cdtr', 'Pty', 'Nm');
                const acct = first(party, credit ? 'DbtrAcct' : 'CdtrAcct', 'Id');
                const cpIban = text(acct, 'IBAN'); const cpOther = text(acct, 'Othr', 'Id');
                const ustrd = desc(d, 'Ustrd').map((x) => (x.textContent ?? '').trim()).filter(Boolean).join(' ');
                const e2e = text(first(d, 'Refs'), 'EndToEndId'); const ref = text(first(d, 'Refs'), 'AcctSvcrRef') || text(e, 'AcctSvcrRef') || text(e, 'NtryRef');
                const strRef = text(first(d, 'RmtInf', 'Strd', 'CdtrRefInf'), 'Ref');
                const vs = findVs(e2e, ustrd, text(first(d, 'Refs'), 'PmtInfId')) || (/^\d{1,10}$/.test(strRef) ? strRef.replace(/^0+(?=\d)/, '') : '');
                const base = { date: date.slice(0, 10), amount: credit ? each : -each, currency: amtEl.getAttribute('Ccy') || 'CZK', vs, ks: '', ss: '', counterparty: who, account: cpIban || cpOther, bankCode: '', message: ustrd, type: text(e, 'AddtlNtryInf') };
                const sig = `${accountKey}|${base.date}|${base.amount}|${vs}|${base.account}|${base.message}`;
                const n = (seen.get(sig) ?? 0) + 1; seen.set(sig, n);
                txs.push({ ...base, txid: `${accountKey}:${ref ? `${ref}-${txs.length}` : `x${sig.length}-${n}`}` });
            }
        }
    }
    return { txs, skipped, iban };
}

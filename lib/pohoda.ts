import { computeTotals, round2, type InvoiceLine, type Receivable } from './billing';
import { splitAddress } from './isdoc';

// Pohoda XML (dataPack 2.0, vydané faktury) k importu v účetním programu POHODA (Import dokladů z XML).
// Struktura je kontrolovaná proti oficiálním schématům STORMWARE (data.xsd, invoice.xsd, type.xsd) nástrojem xmllint.
// To dokazuje formální správnost, NE že konkrétní účetní nastavení (číselné řady, členění DPH, střediska) bude sedět.
// Před ostrým importem vyzkoušejte soubor na kopii účetnictví.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (n: number) => round2(n).toFixed(2);
const tag = (name: string, value: string) => (value ? `<${name}>${esc(value)}</${name}>` : '');

export function splitAccount(raw: string): { prefix: string; no: string; bank: string } | null {
    const m = raw.replace(/\s+/g, '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
    return m ? { prefix: m[1] ?? '', no: m[2], bank: m[3] } : null;
}
// Sazba DPH: 21 % = high, 12 % = low, 0 % = none
const rateVat = (rate: number, vatPayer: boolean) => (!vatPayer || rate === 0 ? 'none' : rate >= 21 ? 'high' : 'low');

export type PohodaInvoice = Receivable & { lines: InvoiceLine[] };
export function buildPohodaXml(invoices: PohodaInvoice[], opt: { ico: string; id: string; note?: string }): { xml: string; warnings: string[] } {
    const warnings: string[] = [];
    const items = invoices.filter((i) => i.number && i.status !== 'draft' && i.status !== 'cancelled').flatMap((i) => {
        if (i.currency !== 'CZK') { warnings.push(`${i.number}: faktura v ${i.currency} není v exportu pro Pohodu (importujte ručně).`); return []; }
        if (!i.lines.length) { warnings.push(`${i.number}: faktura nemá žádné položky.`); return []; }
        const vatPayer = i.supplier_snapshot.vat_payer === true;
        const totals = computeTotals(i.lines, vatPayer);
        const a = splitAddress(i.client_snapshot.address ?? ''); if (!a.parsed && i.client_snapshot.address) warnings.push(`${i.number}: adresu odběratele se nepodařilo rozdělit, je uvedena celá v poli ulice.`);
        const vs = (i.number ?? '').replace(/\D/g, '').slice(0, 20);
        const acc = i.supplier_snapshot.bank_account ? splitAccount(i.supplier_snapshot.bank_account) : null;
        if (i.supplier_snapshot.bank_account && !acc) warnings.push(`${i.number}: číslo účtu „${i.supplier_snapshot.bank_account}“ není ve tvaru čísla účtu a kódu banky, v souboru chybí.`);
        const name = i.client_snapshot.name || i.client_snapshot.firm || '';
        const lines = i.lines.map((l) => `<inv:invoiceItem><inv:text>${esc(l.description.slice(0, 240))}</inv:text><inv:quantity>${esc(String(l.qty))}</inv:quantity><inv:unit>${esc((l.unit || 'ks').slice(0, 10))}</inv:unit><inv:payVAT>false</inv:payVAT><inv:rateVAT>${rateVat(Number(l.vat_rate), vatPayer)}</inv:rateVAT><inv:homeCurrency><typ:unitPrice>${n2(Number(l.unit_price))}</typ:unitPrice></inv:homeCurrency></inv:invoiceItem>`).join('');
        const header = [
            '<inv:invoiceType>issuedInvoice</inv:invoiceType>',
            `<inv:number><typ:numberRequested>${esc(i.number ?? '')}</typ:numberRequested></inv:number>`,
            tag('inv:symVar', vs),
            tag('inv:date', i.issue_date), tag('inv:dateTax', i.issue_date), tag('inv:dateAccounting', i.issue_date), tag('inv:dateDue', i.due_date ?? i.issue_date),
            tag('inv:text', (i.title || 'Právní služby').slice(0, 240)),
            `<inv:partnerIdentity><typ:address>${tag('typ:company', i.client_snapshot.ico ? name : '')}${tag('typ:name', i.client_snapshot.ico ? '' : name)}${tag('typ:city', a.parsed ? a.city : '')}${tag('typ:street', [a.street === '-' ? '' : a.street, a.number].filter(Boolean).join(' '))}${tag('typ:zip', a.parsed ? a.zip : '')}${tag('typ:ico', i.client_snapshot.ico ?? '')}${tag('typ:dic', i.client_snapshot.dic ?? '')}</typ:address></inv:partnerIdentity>`,
            '<inv:paymentType><typ:paymentType>draft</typ:paymentType></inv:paymentType>',
            acc ? `<inv:account><typ:accountNo>${acc.prefix ? `${esc(acc.prefix)}-` : ''}${esc(acc.no)}</typ:accountNo><typ:bankCode>${esc(acc.bank)}</typ:bankCode></inv:account>` : '',
            tag('inv:note', (i.note || '').slice(0, 500)),
        ].join('');
        // Kontrolní součet pro uživatele: Pohoda si částky přepočítá z položek, tady jen hlídáme, že sedí s aplikací
        if (round2(totals.total) < 0) warnings.push(`${i.number}: záporná celková částka.`);
        return [`<dat:dataPackItem id="${esc((i.number ?? i.id).replace(/[^\w.-]+/g, '_').slice(0, 40))}" version="2.0"><inv:invoice version="2.0"><inv:invoiceHeader>${header}</inv:invoiceHeader><inv:invoiceDetail>${lines}</inv:invoiceDetail></inv:invoice></dat:dataPackItem>`];
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<dat:dataPack id="${esc(opt.id)}" ico="${esc(opt.ico)}" application="Kancelar" version="2.0" note="${esc(opt.note ?? 'Vydané faktury z Kanceláře')}" xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd" xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd" xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">\n${items.join('\n')}\n</dat:dataPack>\n`;
    if (!items.length) warnings.push('V období není žádná vydaná faktura v CZK k exportu.');
    return { xml, warnings };
}

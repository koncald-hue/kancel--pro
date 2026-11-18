import { computeTotals, round2, type InvoiceLine, type Receivable } from './billing';
import { splitAddress } from './isdoc';

// Money S3 XML (MoneyData, seznam vydaných faktur) k importu přes XML přenosy → Import z XML.
// Názvy a pořadí elementů odpovídají open-source knihovně ePREHLED-cz/MoneyS3, která formát generuje (FaktVyd, Doklad, Vystaveno,
// DatUcPr, PlnenoDPH, Splatno, VarSymbol, Druh, SazbaDPH1/2, SouhrnDPH, Celkem, DodOdb, SeznamPolozek/Polozka).
// Proti schématu XSD z programu Money S3 ověřený NENÍ: před ostrým importem soubor vyzkoušejte na kopii účetnictví.
// Sazby: SazbaDPH1 = snížená (12 %), SazbaDPH2 = základní (21 %); v souhrnu Zaklad5/DPH5 = snížená, Zaklad22/DPH22 = základní (historické názvy Money).
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (n: number) => round2(n).toFixed(2);
const el = (name: string, value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '' : `<${name}>${esc(String(value))}</${name}>`);

export type MoneyInvoice = Receivable & { lines: InvoiceLine[]; kind?: 'faktura' | 'zaloha' };

export function buildMoneyS3Xml(invoices: MoneyInvoice[], opt: { ico: string }): { xml: string; warnings: string[]; count: number } {
    const warnings: string[] = [];
    const docs = invoices.filter((i) => i.number && i.status !== 'draft' && i.status !== 'cancelled').flatMap((i) => {
        if (i.currency !== 'CZK') { warnings.push(`${i.number}: faktura v ${i.currency} není v exportu pro Money S3 (importujte ručně).`); return []; }
        if (!i.lines.length) { warnings.push(`${i.number}: faktura nemá žádné položky.`); return []; }
        const vatPayer = i.supplier_snapshot.vat_payer === true;
        const t = computeTotals(i.lines, vatPayer);
        const g = (rate: number) => t.groups.find((x) => x.rate === rate) ?? { base: 0, vat: 0 };
        const other = t.groups.filter((x) => ![0, 12, 21].includes(x.rate));
        if (other.length) warnings.push(`${i.number}: sazba DPH ${other.map((x) => `${x.rate} %`).join(', ')} se do souhrnu Money nevejde, zkontrolujte doklad po importu.`);
        const a = splitAddress(i.client_snapshot.address ?? '');
        if (!a.parsed && i.client_snapshot.address) warnings.push(`${i.number}: adresu odběratele se nepodařilo rozdělit, je celá v poli ulice.`);
        const name = i.client_snapshot.name || i.client_snapshot.firm || '';
        const addr = `<Adresa>${el('Ulice', a.parsed ? [a.street, a.number].filter(Boolean).join(' ') : (i.client_snapshot.address ?? ''))}${el('Misto', a.parsed ? a.city : '')}${el('PSC', a.parsed ? a.zip.replace(/\s/g, '') : '')}${el('Stat', 'Česká republika')}${el('KodStatu', 'CZ')}</Adresa>`;
        const partner = `<DodOdb>${el('ObchNazev', name)}${addr.replace('<Adresa>', '<ObchAdresa>').replace('</Adresa>', '</ObchAdresa>')}${el('FaktNazev', name)}${el('ICO', i.client_snapshot.ico)}${el('DIC', i.client_snapshot.dic)}${addr.replace('<Adresa>', '<FaktAdresa>').replace('</Adresa>', '</FaktAdresa>')}${el('Nazev', name)}${addr}${el('PlatceDPH', i.client_snapshot.dic ? 1 : 0)}${el('FyzOsoba', i.client_snapshot.ico ? 0 : 1)}</DodOdb>`;
        const items = i.lines.map((l, idx) => `<Polozka>${el('Popis', l.description.slice(0, 240))}${el('PocetMJ', String(l.qty))}${el('SazbaDPH', vatPayer ? l.vat_rate : 0)}${el('Cena', n2(l.unit_price))}${el('CenaTyp', 0)}${el('Poradi', idx + 1)}</Polozka>`).join('');
        const vs = (i.number ?? '').replace(/\D/g, '').slice(0, 10);
        return [`<FaktVyd>${[
            el('Doklad', i.number), el('Popis', (i.title || 'Právní služby').slice(0, 100)),
            el('Vystaveno', i.issue_date), el('DatUcPr', i.issue_date), el('PlnenoDPH', i.kind === 'zaloha' ? '' : i.issue_date), el('Splatno', i.due_date ?? i.issue_date),
            el('VarSymbol', vs), el('Druh', i.kind === 'zaloha' ? 'F' : 'N'),
            el('SazbaDPH1', 12), el('SazbaDPH2', 21),
            el('Proplatit', n2(t.total)),
            `<SouhrnDPH>${el('Zaklad0', n2(g(0).base))}${el('Zaklad5', n2(g(12).base))}${el('Zaklad22', n2(g(21).base))}${el('DPH5', n2(g(12).vat))}${el('DPH22', n2(g(21).vat))}</SouhrnDPH>`,
            el('Celkem', n2(t.total)),
            partner,
            `<SeznamPolozek>${items}</SeznamPolozek>`,
            el('Uhrada', 'převodem'),
            el('Poznamka', (i.note || '').slice(0, 500)),
        ].join('')}</FaktVyd>`];
    });
    if (!docs.length) warnings.push('V období není žádná vydaná faktura v CZK k exportu.');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<MoneyData ICAgendy="${esc(opt.ico)}" JazykVerze="CZ"><SeznamFaktVyd>${docs.join('')}</SeznamFaktVyd></MoneyData>\n`;
    return { xml, warnings, count: docs.length };
}

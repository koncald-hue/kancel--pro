import { computeTotals, lineBase, round2, type Invoice, type InvoiceLine, type Party } from './billing';
import { toIban } from './qrPayment';

// ISDOC 6.0.2 (otevřený český formát elektronické faktury, který umí načíst většina účetních programů). Struktura ověřena proti oficiálnímu XSD.
const NS = 'http://isdoc.cz/namespace/2013';
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (n: number) => round2(n).toFixed(2);
const UNIT: Record<string, string> = { hod: 'HUR', ks: 'C62', den: 'DAY', km: 'KMT' };

// Adresu „ulice 12, 301 00 Plzeň“ rozdělí na části; co nepozná, vrátí celé jako ulici
export function splitAddress(addr: string): { street: string; number: string; city: string; zip: string; parsed: boolean } {
    const t = addr.trim();
    const m = t.match(/^(.*?),?\s*(\d{3})\s?(\d{2})\s+([^,]+?)\s*$/);
    if (!m) return { street: t || '-', number: '', city: '-', zip: '-', parsed: false };
    const street = m[1].replace(/,\s*$/, '').trim();
    const sn = street.match(/^(.*?)\s+(\d+[\/\d]*[A-Za-z]?)$/);
    return { street: (sn ? sn[1] : street) || '-', number: sn ? sn[2] : '', city: m[4].trim(), zip: `${m[2]}${m[3]}`, parsed: true };
}

function party(tag: string, p: Party, fallbackName: string): string {
    const a = splitAddress(p.address ?? '');
    const name = p.name || p.firm || fallbackName || '-';
    return `<${tag}><Party>${p.ico ? `<PartyIdentification><ID>${esc(p.ico)}</ID></PartyIdentification>` : '<PartyIdentification><ID>-</ID></PartyIdentification>'}<PartyName><Name>${esc(name)}</Name></PartyName><PostalAddress><StreetName>${esc(a.street)}</StreetName><BuildingNumber>${esc(a.number || '-')}</BuildingNumber><CityName>${esc(a.city)}</CityName><PostalZone>${esc(a.zip)}</PostalZone><Country><IdentificationCode>CZ</IdentificationCode><Name>Česká republika</Name></Country></PostalAddress>${p.dic ? `<PartyTaxScheme><CompanyID>${esc(p.dic)}</CompanyID><TaxScheme>VAT</TaxScheme></PartyTaxScheme>` : ''}</Party></${tag}>`;
}

export type IsdocResult = { xml: string; warnings: string[] };
export function buildIsdoc(inv: Invoice, lines: InvoiceLine[], uuid: string): IsdocResult | null {
    if (!inv.number || inv.currency !== 'CZK') return null;
    const warnings: string[] = [];
    const vatPayer = inv.supplier_snapshot.vat_payer === true;
    const totals = computeTotals(lines, vatPayer);
    const sup = splitAddress(inv.supplier_snapshot.address ?? ''); const cus = splitAddress(inv.client_snapshot.address ?? '');
    if (!sup.parsed) warnings.push(`${inv.number}: adresu dodavatele se nepodařilo rozdělit na ulici, PSČ a město.`);
    if (!cus.parsed) warnings.push(`${inv.number}: adresu odběratele se nepodařilo rozdělit na ulici, PSČ a město.`);
    const lineXml = lines.map((l, i) => {
        const rate = vatPayer ? l.vat_rate : 0;
        const base = lineBase(l); const vat = round2(base * rate / 100);
        return `<InvoiceLine><ID>${i + 1}</ID><InvoicedQuantity unitCode="${UNIT[l.unit] ?? 'C62'}">${l.qty}</InvoicedQuantity><LineExtensionAmount>${n2(base)}</LineExtensionAmount><LineExtensionAmountTaxInclusive>${n2(base + vat)}</LineExtensionAmountTaxInclusive><LineExtensionTaxAmount>${n2(vat)}</LineExtensionTaxAmount><UnitPrice>${n2(l.unit_price)}</UnitPrice><UnitPriceTaxInclusive>${n2(l.unit_price * (1 + rate / 100))}</UnitPriceTaxInclusive><ClassifiedTaxCategory><Percent>${rate}</Percent><VATCalculationMethod>0</VATCalculationMethod></ClassifiedTaxCategory><Item><Description>${esc(l.description || '-')}</Description></Item></InvoiceLine>`;
    }).join('');
    const taxSub = totals.groups.map((g) => `<TaxSubTotal><TaxableAmount>${n2(g.base)}</TaxableAmount><TaxAmount>${n2(g.vat)}</TaxAmount><TaxInclusiveAmount>${n2(g.base + g.vat)}</TaxInclusiveAmount><AlreadyClaimedTaxableAmount>0.00</AlreadyClaimedTaxableAmount><AlreadyClaimedTaxAmount>0.00</AlreadyClaimedTaxAmount><AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount><DifferenceTaxableAmount>${n2(g.base)}</DifferenceTaxableAmount><DifferenceTaxAmount>${n2(g.vat)}</DifferenceTaxAmount><DifferenceTaxInclusiveAmount>${n2(g.base + g.vat)}</DifferenceTaxInclusiveAmount><TaxCategory><Percent>${g.rate}</Percent></TaxCategory></TaxSubTotal>`).join('');
    const iban = toIban(inv.supplier_snapshot.bank_account ?? '');
    const acct = (inv.supplier_snapshot.bank_account ?? '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
    const pay = `<PaymentMeans><Payment><PaidAmount>${n2(totals.total)}</PaidAmount><PaymentMeansCode>42</PaymentMeansCode><Details><PaymentDueDate>${inv.due_date ?? inv.issue_date}</PaymentDueDate><ID>${esc(acct ? `${acct[1] ? `${acct[1]}-` : ''}${acct[2]}` : (iban ?? '-'))}</ID><BankCode>${esc(acct ? acct[3] : '-')}</BankCode><Name>-</Name><IBAN>${esc(iban ?? '-')}</IBAN><BIC>-</BIC><VariableSymbol>${esc(inv.number.replace(/\D/g, '').slice(0, 10))}</VariableSymbol></Details></Payment></PaymentMeans>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="${NS}" version="6.0.2"><DocumentType>1</DocumentType><ID>${esc(inv.number)}</ID><UUID>${uuid}</UUID><IssuingSystem>Kancelář</IssuingSystem><IssueDate>${inv.issue_date}</IssueDate><TaxPointDate>${inv.issue_date}</TaxPointDate><VATApplicable>${vatPayer}</VATApplicable><ElectronicPossibilityAgreementReference>Elektronická faktura</ElectronicPossibilityAgreementReference>${inv.note ? `<Note>${esc(inv.note.slice(0, 1000))}</Note>` : ''}<LocalCurrencyCode>CZK</LocalCurrencyCode><CurrRate>1</CurrRate><RefCurrRate>1</RefCurrRate>${party('AccountingSupplierParty', inv.supplier_snapshot, 'Dodavatel')}${party('AccountingCustomerParty', inv.client_snapshot, 'Odběratel')}<InvoiceLines>${lineXml}</InvoiceLines><TaxTotal>${taxSub}<TaxAmount>${n2(totals.vat)}</TaxAmount></TaxTotal><LegalMonetaryTotal><TaxExclusiveAmount>${n2(totals.base)}</TaxExclusiveAmount><TaxInclusiveAmount>${n2(totals.total)}</TaxInclusiveAmount><AlreadyClaimedTaxExclusiveAmount>0.00</AlreadyClaimedTaxExclusiveAmount><AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount><DifferenceTaxExclusiveAmount>${n2(totals.base)}</DifferenceTaxExclusiveAmount><DifferenceTaxInclusiveAmount>${n2(totals.total)}</DifferenceTaxInclusiveAmount><PayableRoundingAmount>0.00</PayableRoundingAmount><PaidDepositsAmount>0.00</PaidDepositsAmount><PayableAmount>${n2(totals.total)}</PayableAmount></LegalMonetaryTotal>${pay}</Invoice>`;
    return { xml, warnings };
}

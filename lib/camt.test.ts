// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isCamt, parseCamt053 } from './camt';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt><Id>1</Id><Acct><Id><IBAN>CZ6508000000192000145399</IBAN></Id></Acct>
<Ntry><NtryRef>A1</NtryRef><Amt Ccy="CZK">12100.00</Amt><CdtDtInd>CRDT</CdtDtInd><BookgDt><Dt>2026-11-09</Dt></BookgDt>
<NtryDtls><TxDtls><Refs><AcctSvcrRef>REF1</AcctSvcrRef><EndToEndId>VS2026001</EndToEndId></Refs><RltdPties><Dbtr><Nm>Jan Novák</Nm></Dbtr><DbtrAcct><Id><IBAN>CZ0201000000000000012345</IBAN></Id></DbtrAcct></RltdPties><RmtInf><Ustrd>Faktura 2026-001</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="CZK">500.00</Amt><CdtDtInd>DBIT</CdtDtInd><BookgDt><Dt>2026-11-10</Dt></BookgDt><NtryDtls><TxDtls><Refs><AcctSvcrRef>REF2</AcctSvcrRef></Refs><RltdPties><Cdtr><Nm>Dodavatel</Nm></Cdtr></RltdPties></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="CZK">900.00</Amt><CdtDtInd>CRDT</CdtDtInd><BookgDt><Dt>2026-11-11</Dt></BookgDt><NtryDtls><TxDtls><Refs><AcctSvcrRef>REF3</AcctSvcrRef></Refs><RmtInf><Strd><CdtrRefInf><Ref>0000554433</Ref></CdtrRefInf></Strd></RmtInf></TxDtls></NtryDtls></Ntry>
</Stmt></BkToCstmrStmt></Document>`;

describe('camt.053', () => {
    it('detects and parses credits, debits, variable symbol and counterparty', () => {
        expect(isCamt(xml)).toBe(true);
        expect(isCamt('Datum;Objem')).toBe(false);
        const r = parseCamt053(xml, 'k');
        expect(r.iban).toBe('CZ6508000000192000145399');
        expect(r.txs).toHaveLength(3);
        expect(r.txs[0]).toMatchObject({ date: '2026-11-09', amount: 12100, currency: 'CZK', vs: '2026001', counterparty: 'Jan Novák', account: 'CZ0201000000000000012345', message: 'Faktura 2026-001' });
        expect(r.txs[1]).toMatchObject({ amount: -500, counterparty: 'Dodavatel' });
        expect(r.txs[2].vs).toBe('554433');
        expect(new Set(r.txs.map((t) => t.txid)).size).toBe(3);
    });
    it('returns nothing for broken XML', () => { expect(parseCamt053('<a>').txs).toEqual([]); });
});

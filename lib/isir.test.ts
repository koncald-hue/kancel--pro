import { describe, expect, it } from 'vitest';
import { buildRequest, diffHits, parseResponse, stateLabel } from './isir';

const OK = `<soap:Envelope><soap:Body><ns2:getIsirWsCuzkDataResponse xmlns:ns2="http://isirws.cca.cz/types/"><data><ic>09322060</ic><cisloSenatu>92</cisloSenatu><druhVec>INS</druhVec><bcVec>19385</bcVec><rocnik>2025</rocnik><nazevOrganizace>Městský soud v Praze</nazevOrganizace><nazevOsoby>Stavby Friede s.r.o.</nazevOsoby><druhStavKonkursu>KONKURS</druhStavKonkursu><urlDetailRizeni>https://isir.justice.cz/isir/ueu/evidence_upadcu_detail.do?id=ABC</urlDetailRizeni><datumPmZahajeniUpadku>2025-12-30Z</datumPmZahajeniUpadku></data><stav><pocetVysledku>1</pocetVysledku></stav></ns2:getIsirWsCuzkDataResponse></soap:Body></soap:Envelope>`;
const EMPTY = `<soap:Envelope><soap:Body><ns2:getIsirWsCuzkDataResponse xmlns:ns2="x"><stav><kodChyby>WS2</kodChyby><textChyby>Prázdný výsledek</textChyby></stav></ns2:getIsirWsCuzkDataResponse></soap:Body></soap:Envelope>`;

describe('ISIR', () => {
    it('parses a result', () => {
        const r = parseResponse(OK);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.hits).toEqual([{ spis: '92 INS 19385/2025', court: 'Městský soud v Praze', debtor: 'Stavby Friede s.r.o.', state: 'Konkurs', started: '2025-12-30', ended: null, url: 'https://isir.justice.cz/isir/ueu/evidence_upadcu_detail.do?id=ABC' }]);
    });
    it('treats an empty result as no insolvency and other codes as errors', () => {
        expect(parseResponse(EMPTY)).toEqual({ ok: true, hits: [] });
        expect(parseResponse('<x><kodChyby>SERVER1</kodChyby><textChyby>Chyba</textChyby></x>')).toEqual({ ok: false, error: 'Chyba' });
        expect(parseResponse('<html>nic</html>').ok).toBe(false);
    });
    it('ignores detail links that do not point to the register', () => {
        const r = parseResponse(OK.replace('https://isir.justice.cz/', 'https://evil.example/'));
        if (r.ok) expect(r.hits[0].url).toBe('');
    });
    it('builds escaped requests', () => {
        expect(buildRequest({ kind: 'firma', ic: '27082440' })).toContain('<ic>27082440</ic>');
        const p = buildRequest({ kind: 'osoba', name: 'A<b>', firstName: 'Jan', birth: '1980-01-02' });
        expect(p).toContain('A&lt;b&gt;');
        expect(p).toContain('<datumNarozeni>1980-01-02</datumNarozeni>');
    });
    it('detects new and changed proceedings', () => {
        const fresh = [{ spis: 'A', court: '', debtor: '', state: 'Konkurs', started: null, ended: null, url: '' }, { spis: 'B', court: '', debtor: '', state: 'Konkurs', started: null, ended: '2026-01-01', url: '' }, { spis: 'C', court: '', debtor: '', state: 'Konkurs', started: null, ended: null, url: '' }];
        const d = diffHits([{ spis: 'A', state: 'Konkurs', ended: null }, { spis: 'B', state: 'Konkurs', ended: null }], fresh);
        expect(d.added.map((h) => h.spis)).toEqual(['C']);
        expect(d.changed.map((h) => h.spis)).toEqual(['B']);
    });
    it('labels states', () => { expect(stateLabel('REORGANIZ')).toBe('Reorganizace'); expect(stateLabel('NEZNAMY')).toBe('Neznamy'); });
});

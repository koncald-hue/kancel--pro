import { describe, expect, it } from 'vitest';
import { missingForConfirm, suggestReview, type Ident } from './aml';

const base: Ident = { method: 'osobne', status: 'draft', full_name: 'Jan Novák', birth_date: '1985-03-02', address: 'Dlouhá 12, Plzeň', doc_type: 'OP', doc_number: '123456789', doc_expires: '2030-01-01', is_company: false, company_ico: '', beneficial_owner: '', pep: 'ne', pep_note: '', risk: 'standardni', purpose: 'Právní zastoupení', online_result: null };

describe('AML identification', () => {
    it('lets a complete in-person identification be confirmed', () => { expect(missingForConfirm(base, '2026-11-16')).toEqual([]); });
    it('reports what is missing', () => {
        const m = missingForConfirm({ ...base, doc_number: '', doc_expires: '2020-01-01', pep: 'nevim', purpose: '' }, '2026-11-16');
        expect(m).toEqual(expect.arrayContaining(['číslo dokladu', 'doklad je prošlý', 'posouzení politicky exponované osoby', 'účel a povaha obchodního vztahu']));
    });
    it('needs the online result for Bank iD and the beneficial owner for companies', () => {
        expect(missingForConfirm({ ...base, method: 'bankid' }, '2026-11-16')).toContain('klient zatím neprovedl ověření');
        expect(missingForConfirm({ ...base, method: 'bankid', online_result: {} }, '2026-11-16')).toEqual([]);
        expect(missingForConfirm({ ...base, is_company: true, birth_date: null }, '2026-11-16')).toContain('skutečný majitel');
    });
    it('does not allow low risk for a politically exposed person', () => {
        expect(missingForConfirm({ ...base, pep: 'ano', risk: 'nizke' }, '2026-11-16')).toHaveLength(1);
    });
    it('suggests an earlier review for higher risk', () => {
        const d = new Date('2026-11-16T00:00:00Z');
        expect(suggestReview('vysoke', d)).toBe('2027-11-16'); expect(suggestReview('standardni', d)).toBe('2028-11-16'); expect(suggestReview('nizke', d)).toBe('2029-11-16');
    });
});

import { describe, expect, it } from 'vitest';
import { matchCases } from './mailMatch';

const cases = [
    { id: 'a', title: 'Novák proti Dvořákovi', client_id: 'c1', client_email: 'jan@novak.cz', client_name: 'Jan Novák', reference: '12 C 345/2026', status: 'open' },
    { id: 'b', title: 'Spor o nájem', client_id: null, client_email: 'a@gmail.com', client_name: 'Eva Malá', reference: null, status: 'open' },
    { id: 'c', title: 'Starý spis', client_id: null, client_email: 'jan@novak.cz', client_name: 'Jan Novák', reference: null, status: 'done' },
];
describe('přiřazení e-mailu ke spisu', () => {
    it('přesná adresa klienta je nejjistější', () => { const m = matchCases({ counterparty: 'Jan Novák <jan@novak.cz>', subject: 'Dotaz', text: '' }, cases, []); expect(m[0].caseId).toBe('a'); expect(m[0].reason).toBe('adresa klienta'); });
    it('vyřešený spis je až za otevřenou', () => { const m = matchCases({ counterparty: 'jan@novak.cz', subject: '', text: '' }, cases, []); expect(m.map((x) => x.caseId)).toEqual(['a', 'c']); });
    it('spisová značka v předmětu zabere i od cizí adresy', () => { const m = matchCases({ counterparty: 'podatelna@soud.cz', subject: 'Usnesení 12 C 345/2026', text: '' }, cases, []); expect(m[0]).toMatchObject({ caseId: 'a', reason: 'spisová značka v předmětu' }); });
    it('firma klienta se pozná podle domény, běžná schránka ne', () => {
        expect(matchCases({ counterparty: 'ucetni@novak.cz', subject: '', text: '' }, cases, [])[0].reason).toBe('firma klienta');
        expect(matchCases({ counterparty: 'jiny@gmail.com', subject: '', text: '' }, cases, [])).toEqual([]);
    });
    it('nic nesedí → prázdný výsledek', () => { expect(matchCases({ counterparty: 'x@y.cz', subject: 'Nabídka', text: 'ahoj' }, cases, [])).toEqual([]); });
});

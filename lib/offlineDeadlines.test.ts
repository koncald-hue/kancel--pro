import { describe, expect, it } from 'vitest';
import { pickUpcoming } from './offlineDeadlines';

const cases = [{ id: 'a', title: 'Spor Novák' }, { id: 'b', title: 'Dědictví' }];
const rows = [
    { case_id: 'a', title: 'Odvolání', due_date: '2026-11-25', done: false },
    { case_id: 'b', title: 'Vyjádření', due_date: '2026-11-20', done: false },
    { case_id: 'a', title: 'Hotovo', due_date: '2026-11-21', done: true },
    { case_id: 'a', title: 'Prošlé', due_date: '2026-11-10', done: false },
    { case_id: 'a', title: 'Příliš daleko', due_date: '2026-12-31', done: false },
    { case_id: 'x', title: 'Bez věci', due_date: '2026-12-03', done: false },
];

describe('lhůty pro offline', () => {
    const out = pickUpcoming(rows, cases, '2026-11-19');
    it('vybere jen nesplněné lhůty v příštích 14 dnech, od nejbližší', () => {
        expect(out.map((i) => i.title)).toEqual(['Vyjádření', 'Odvolání', 'Bez věci']);
    });
    it('hranice okna: 14. den ještě ano, 15. už ne', () => {
        const r = [{ case_id: 'a', title: 'A', due_date: '2026-12-03', done: false }, { case_id: 'a', title: 'B', due_date: '2026-12-04', done: false }];
        expect(pickUpcoming(r, cases, '2026-11-19').map((i) => i.title)).toEqual(['A']);
    });
    it('ukládá jen název, datum a název věci', () => {
        expect(Object.keys(out[0]).sort()).toEqual(['caseTitle', 'due', 'title']);
        expect(out[0].caseTitle).toBe('Dědictví');
    });
});

import { describe, expect, it } from 'vitest';
import { buildAlerts } from './attention';

const today = '2026-11-20';
describe('buildAlerts', () => {
    it('upozorní na rozpočet a plné moci, závažné první', () => {
        const a = buildAlerts(
            [{ id: 'c1', title: 'Spis A', budget_czk: 10000, budget_warn_pct: 80 }, { id: 'c2', title: 'Spis B', budget_czk: 10000, budget_warn_pct: 80 }, { id: 'c3', title: 'Bez rozpočtu', budget_czk: null, budget_warn_pct: null }],
            [{ case_id: 'c1', amount: 8500 }, { case_id: 'c2', amount: 12000 }, { case_id: 'c3', amount: 99999 }],
            [{ id: 'p1', grantor: 'Novák', case_id: null, valid_from: null, valid_to: '2026-11-25' }, { id: 'p2', grantor: 'Stará', case_id: null, valid_from: null, valid_to: '2026-01-01' }],
            today);
        expect(a.map((x) => x.id)).toEqual(['b-c2', 'b-c1', 'p-p1']);
        expect(a[0].tone).toBe('bad');
        expect(a[2].text).toContain('za 5 dní');
    });
});

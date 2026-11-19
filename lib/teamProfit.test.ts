import { describe, expect, it } from 'vitest';
import { teamStats } from './teamProfit';

const m = (name: string, shared: boolean, minutes: number | null, amount: number | null, billed: number | null) => ({ user_id: name, name, shared, minutes, amount, billed_minutes: billed });
describe('výkon po právnících', () => {
    const s = teamStats([m('Eva', true, 600, 20000, 300), m('Petr', false, null, null, null), m('Jan', true, 1200, 30000, 1200), m('Nula', true, 0, 0, 0)]);
    it('počítá jen sdílené a nesdílející uvádí zvlášť', () => {
        expect(s.hidden).toEqual(['Petr']);
        expect(s.totals).toMatchObject({ sharing: 3, total: 4, hours: 30, value: 50000 });
    });
    it('vypočítá nevyfakturované, realizaci a hodinový výnos', () => {
        const eva = s.rows.find((r) => r.name === 'Eva')!;
        expect(eva).toMatchObject({ hours: 10, unbilledHours: 5, unbilledValue: 10000, realization: 50, avgRate: 2000 });
        expect(s.rows.find((r) => r.name === 'Jan')).toMatchObject({ realization: 100, unbilledValue: 0 });
    });
    it('řadí podle hodnoty práce a nulový záznam nedělí nulou', () => {
        expect(s.rows[0].name).toBe('Jan');
        expect(s.rows.find((r) => r.name === 'Nula')).toMatchObject({ realization: null, avgRate: null });
        expect(s.totals.realization).toBe(83);
    });
});

import { describe, expect, it } from 'vitest';
import { cleanItems, dueFor, planTemplate, shiftDays } from './taskTemplates';

describe('šablony úkolů', () => {
    it('kalendářní dny', () => { expect(shiftDays('2026-11-18', 7, false)).toBe('2026-11-25'); expect(shiftDays('2026-11-18', -3, false)).toBe('2026-11-15'); });
    it('pracovní dny přeskočí víkend a svátek', () => {
        expect(shiftDays('2026-11-13', 1, true)).toBe('2026-11-16'); // pátek → pondělí
        expect(shiftDays('2026-11-16', 1, true)).toBe('2026-11-18'); // 17. 11. je svátek
        expect(shiftDays('2026-12-23', 1, true)).toBe('2026-12-28'); // 24.–26. 12. svátky, 27. neděle
        expect(shiftDays('2026-11-18', -1, true)).toBe('2026-11-16');
    });
    it('nulový posun v pracovních dnech skončí na pracovním dni', () => { expect(shiftDays('2026-11-14', 0, true)).toBe('2026-11-16'); });
    it('od data události: bez data se úkol nespočítá', () => {
        expect(dueFor({ title: 'x', offset: -3, base: 'event', workdays: false }, '2026-11-18', null)).toBeNull();
        expect(dueFor({ title: 'x', offset: -3, base: 'event', workdays: false }, '2026-11-18', '2026-12-10')).toBe('2026-12-07');
    });
    it('plán rozdělí hotové a přeskočené', () => {
        const p = planTemplate([{ title: 'a', offset: 1, base: 'start', workdays: false }, { title: 'b', offset: 1, base: 'event', workdays: false }], '2026-11-18', null);
        expect(p.ready).toEqual([{ title: 'a', due: '2026-11-19' }]); expect(p.skipped).toEqual(['b']);
    });
    it('čištění vstupu', () => {
        expect(cleanItems('x')).toEqual([]);
        expect(cleanItems([{ title: '  ', offset: 1 }, { title: 'ok', offset: '5', base: 'event', workdays: true }, { title: 'moc', offset: 99999 }, { title: 'nan', offset: 'a' }])).toEqual([{ title: 'ok', offset: 5, base: 'event', workdays: true }]);
        expect(cleanItems(Array.from({ length: 60 }, () => ({ title: 't', offset: 1 }))).length).toBe(40);
    });
});

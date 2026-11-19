import { describe, expect, it } from 'vitest';
import { daysLeft, powerState, sortPowers } from './powers';

const today = '2026-11-19';
describe('plné moci', () => {
    it('určí stav podle platnosti', () => {
        expect(powerState({ valid_from: null, valid_to: null }, today)).toBe('valid');
        expect(powerState({ valid_from: '2026-12-01', valid_to: null }, today)).toBe('planned');
        expect(powerState({ valid_from: '2026-01-01', valid_to: '2026-11-18' }, today)).toBe('expired');
        expect(powerState({ valid_from: '2026-01-01', valid_to: '2026-12-10' }, today)).toBe('ending');
        expect(powerState({ valid_from: '2026-01-01', valid_to: '2027-06-01' }, today)).toBe('valid');
        expect(powerState({ valid_from: null, valid_to: today }, today)).toBe('ending');
    });
    it('spočítá zbývající dny', () => { expect(daysLeft({ valid_to: '2026-11-29' }, today)).toBe(10); expect(daysLeft({ valid_to: null }, today)).toBeNull(); });
    it('řadí ty, které brzy končí, první a vypršelé poslední', () => {
        const list = [{ n: 'a', valid_from: null, valid_to: '2026-01-01' }, { n: 'b', valid_from: null, valid_to: '2027-01-01' }, { n: 'c', valid_from: null, valid_to: '2026-12-01' }];
        expect(sortPowers(list, today).map((x) => x.n)).toEqual(['c', 'b', 'a']);
    });
});

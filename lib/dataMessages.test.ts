import { describe, expect, it } from 'vitest';
import { suggestCase } from './dataMessages';

const cases = [
    { id: 'a', title: 'Spor o dodávku', reference: '12 C 34/2026', status: 'open' as const },
    { id: 'b', title: 'Pracovní smlouva Novák', reference: '', status: 'open' as const },
    { id: 'c', title: 'Stará věc', reference: '12 C 34/2026', status: 'done' as const },
];

describe('suggestCase', () => {
    it('matches by case reference ignoring spaces, dots and case, preferring open cases', () => {
        expect(suggestCase(cases, 'Usnesení ve věci sp. zn. 12C34/2026')).toBe('a');
        expect(suggestCase(cases, 'Výzva č.j. 12 c 34/2026')).toBe('a');
    });
    it('falls back to the case title and otherwise suggests nothing', () => {
        expect(suggestCase(cases, 'Dotaz k věci: Pracovní smlouva Novák')).toBe('b');
        expect(suggestCase(cases, 'Něco úplně jiného')).toBe('');
        expect(suggestCase(cases, '')).toBe('');
    });
});

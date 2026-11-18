import { describe, expect, it } from 'vitest';
import { buildRoutePrompt, parseRoute, ROUTE_MAX_CASES } from './aiRoute';

describe('aiRoute', () => {
    it('sestaví text s očíslovanými věcmi a ořízne jejich počet', () => {
        const cases = Array.from({ length: 60 }, (_, i) => ({ id: `c${i}`, title: `Věc ${i}` }));
        const p = buildRoutePrompt({ subject: 'Dotaz', text: 'Dobrý den' }, cases);
        expect(p.list).toHaveLength(ROUTE_MAX_CASES); expect(p.text).toContain('1. Věc 0'); expect(p.text).not.toContain('Věc 45');
    });
    it('parsuje odpověď a hlídá meze', () => {
        expect(parseRoute('{"vec": 2, "duvod": "stejné jméno"}', 3)).toEqual({ index: 1, reason: 'stejné jméno' });
        expect(parseRoute('Zde: {"vec":0,"duvod":"nic"}', 3).index).toBeNull();
        expect(parseRoute('{"vec": 9}', 3).index).toBeNull();
        expect(parseRoute('{"vec": "x"}', 3).index).toBeNull();
        expect(parseRoute('žádný json', 3)).toEqual({ index: null, reason: '' });
    });
});

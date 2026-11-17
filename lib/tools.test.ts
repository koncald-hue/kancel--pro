import { describe, expect, it } from 'vitest';
import { TOOLS, matchTools, validateSuggestions } from './tools';

const top = (q: string) => matchTools(q)[0]?.tool.id;
describe('tool finder', () => {
    it('finds the right tool by name, synonym or intent', () => {
        expect(top('katastr')).toBe('katastr'); expect(top('chci se podívat na pozemek')).toBe('katastr'); expect(top('list vlastnictví')).toBe('katastr');
        expect(top('kdo je jednatel firmy')).toBe('rejstriky'); expect(top('živnostenský rejstřík')).toBe('rejstriky'); expect(top('ičo')).toBe('rejstriky');
        expect(top('datovka')).toBe('schranka'); expect(top('odeslat podání soudu')).toBe('schranka');
        expect(top('dlužník v úpadku')).toBe('insolvence'); expect(top('import z excelu')).toBe('import');
        expect(top('kalendář v telefonu')).toBe('nastaveni'); expect(top('zapsat čas')).toBe('vykazy');
    });
    it('returns nothing for unrelated or too short input', () => {
        expect(matchTools('a')).toEqual([]); expect(matchTools('xqzvw')).toEqual([]);
    });
    it('accepts only known tools from the AI answer, at most three, without duplicates', () => {
        const ok = validateSuggestions({ suggestions: [{ id: 'katastr', reason: 'Parcely.' }, { id: 'katastr', reason: 'dup' }, { id: 'neexistuje', reason: 'x' }, { id: 'rejstriky' }, { id: 'veci' }, { id: 'klienti' }] });
        expect(ok.map((s) => s.tool.id)).toEqual(['katastr', 'rejstriky', 'veci']);
        expect(validateSuggestions(null)).toEqual([]); expect(validateSuggestions({ suggestions: 'x' })).toEqual([]);
    });
    it('keeps ids unique and links under /kancelar', () => {
        expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
        expect(TOOLS.every((t) => t.href.startsWith('/kancelar'))).toBe(true);
    });
});

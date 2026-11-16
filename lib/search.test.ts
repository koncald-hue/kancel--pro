import { describe, expect, it } from 'vitest';
import { KINDS, groupResults, splitMatch, type SearchRow } from './search';

const row = (kind: string, rank: number, id = kind + rank): SearchRow => ({ kind, id, case_id: 'c1', title: id, snippet: null, rank });

describe('search results', () => {
    it('groups by kind in a fixed order with better matches first', () => {
        const g = groupResults([row('faktura', 2), row('klient', 2, 'b'), row('vec', 2, 'z'), row('klient', 1, 'a')]);
        expect(g.map((x) => x.kind)).toEqual(['vec', 'klient', 'faktura']);
        expect(g[1].rows.map((r) => r.id)).toEqual(['a', 'b']);
    });
    it('links notes and files to their case and cases to themselves', () => {
        expect(KINDS.zapis.href(row('zapis', 2))).toBe('/kancelar/veci/c1');
        expect(KINDS.vec.href({ ...row('vec', 1), id: 'abc' })).toBe('/kancelar/veci/abc');
        expect(KINDS.zapis.href({ ...row('zapis', 2), case_id: null })).toBe('/kancelar/veci');
    });
    it('highlights without regard to case or diacritics', () => {
        expect(splitMatch('Jan Novák a spol.', 'novak')).toEqual(['Jan ', 'Novák', ' a spol.']);
        expect(splitMatch('nic', 'xyz')).toEqual(['nic', '', '']);
    });
});

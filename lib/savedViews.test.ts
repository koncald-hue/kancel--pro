import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER, isDefault, matchesFilter, parseFilter } from './savedViews';

const c = { status: 'open', title: 'Novák proti Dvořákovi', summary: '', situation: '', client_name: 'Novák', parent_id: null };
describe('uložené přehledy', () => {
    it('poškozený filtr vrátí na výchozí', () => { expect(parseFilter(null)).toEqual(DEFAULT_FILTER); expect(parseFilter({ within: 99, kind: 'x', status: 'y' })).toEqual(DEFAULT_FILTER); expect(isDefault(parseFilter({}))).toBe(true); });
    it('filtruje podle klienta, lhůty a podspisu', () => {
        expect(matchesFilter(c, 5, { ...DEFAULT_FILTER, client: 'Novák', within: 7 })).toBe(true);
        expect(matchesFilter(c, 20, { ...DEFAULT_FILTER, within: 7 })).toBe(false);
        expect(matchesFilter(c, null, { ...DEFAULT_FILTER, within: 30 })).toBe(false);
        expect(matchesFilter({ ...c, parent_id: 'x' }, null, { ...DEFAULT_FILTER, kind: 'main' })).toBe(false);
        expect(matchesFilter(c, null, { ...DEFAULT_FILTER, q: 'dvořák' })).toBe(true);
    });
});

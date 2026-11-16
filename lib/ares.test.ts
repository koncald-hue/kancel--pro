import { describe, expect, it } from 'vitest';
import { cleanIco, isSearchableName, isValidIco, normalizeCompany } from './ares';

describe('ARES helpers', () => {
    it('validates the IČO checksum', () => {
        expect(isValidIco('27082440')).toBe(true);
        expect(isValidIco('270 824 40')).toBe(true);
        expect(isValidIco('27082441')).toBe(false);
        expect(isValidIco('1234')).toBe(false);
        expect(cleanIco(' 270 824 40 ')).toBe('27082440');
    });
    it('normalizes a company and rejects incomplete records', () => {
        expect(normalizeCompany({ ico: '27082440', obchodniJmeno: 'Alza.cz a.s.', dic: 'CZ27082440', sidlo: { textovaAdresa: 'Jankovcova 1522/53, Holešovice, 17000 Praha 7' } }))
            .toEqual({ ico: '27082440', name: 'Alza.cz a.s.', dic: 'CZ27082440', address: 'Jankovcova 1522/53, Holešovice, 17000 Praha 7' });
        expect(normalizeCompany({ ico: '27082440' })).toBeNull();
        expect(normalizeCompany({ ico: 'x', obchodniJmeno: 'A' })).toBeNull();
        expect(normalizeCompany(null)).toBeNull();
    });
    it('limits name searches', () => {
        expect(isSearchableName('ab')).toBe(false);
        expect(isSearchableName('Alza')).toBe(true);
    });
});

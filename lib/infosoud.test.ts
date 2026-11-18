import { describe, expect, it } from 'vitest';
import { districtCourtCode, infosoudDirectLink, isCourt, parseFileNumber } from './infosoud';

describe('parseFileNumber', () => {
    it('reads common Czech court file numbers', () => {
        expect(parseFileNumber('10 C 123/2024')).toMatchObject({ senat: 10, druh: 'C', cislo: 123, rocnik: 2024, text: '10 C 123/2024' });
        expect(parseFileNumber('10 C 123/2024-45')).toMatchObject({ senat: 10, druh: 'C', cislo: 123, rocnik: 2024 });
        expect(parseFileNumber('29 Cdo 1234/2020')).toMatchObject({ senat: 29, druh: 'Cdo', cislo: 1234, rocnik: 2020 });
        expect(parseFileNumber('KSPL 20 INS 1234/2023')).toMatchObject({ senat: 20, druh: 'INS', cislo: 1234, rocnik: 2023 });
        expect(parseFileNumber('sp. zn. 12 T 34/2026')).toMatchObject({ senat: 12, druh: 'T', cislo: 34, rocnik: 2026 });
        expect(parseFileNumber('Nc 5/2025')).toMatchObject({ senat: null, druh: 'NC', cislo: 5, rocnik: 2025 });
    });
    it('rejects things that are not file numbers', () => {
        for (const bad of ['', 'Smlouva o dílo', 'MěÚ Plzeň 2024', '10 C 1/1850', 'č.j. 123/2024']) expect(parseFileNumber(bad)).toBeNull();
    });
    it('recognises courts', () => {
        expect(isCourt('Okresní soud Plzeň-město')).toBe(true);
        expect(isCourt('Městský úřad Plzeň')).toBe(false);
    });
});

describe('direct link', () => {
    it('maps court names to InfoSoud codes', () => {
        expect(districtCourtCode('Okresní soud Plzeň-město')).toBe('OSZPCPM');
        expect(districtCourtCode('OS Plzeň-město')).toBe('OSZPCPM');
        expect(districtCourtCode('Obvodní soud Praha 1')).toBe('OSPHA01');
        expect(districtCourtCode('Okresní soud pro Prahu 1')).toBeNull();
        expect(districtCourtCode('Krajský soud v Plzni')).toBeNull();
        expect(districtCourtCode('')).toBeNull();
    });
    it('builds the verified deep link for district courts only', () => {
        const fn = parseFileNumber('10 C 123/2024')!;
        expect(infosoudDirectLink(fn, 'Obvodní soud Praha 1')).toBe('https://infosoud.gov.cz/InfoSoud/detail-rizeni?typOrganizace=VSECHNY_KRAJE&okresniSoud=OSPHA01&cisloSenatu=10&druhVeci=C&bcVec=123&rocnik=2024');
        expect(infosoudDirectLink(fn, 'Krajský soud v Plzni')).toBeNull();
        expect(infosoudDirectLink(parseFileNumber('Nc 5/2025')!, 'Okresní soud Plzeň-město')).toBeNull();
        expect(infosoudDirectLink(parseFileNumber('10 C 12/2005')!, 'Okresní soud Plzeň-město')).toBeNull();
    });
});

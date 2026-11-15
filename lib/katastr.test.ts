import { describe, expect, it } from 'vitest';
import { normalizeParcel, parcelLabel, parseParcelNumber, searchKu } from './katastr';

describe('katastr', () => {
    it('parses parcel numbers', () => {
        expect(parseParcelNumber('123/4')).toEqual({ kmen: 123, poddeleni: 4, druh: 2 });
        expect(parseParcelNumber(' 56 ')).toEqual({ kmen: 56, druh: 2 });
        expect(parseParcelNumber('st. 12/2')).toEqual({ kmen: 12, poddeleni: 2, druh: 1 });
        expect(parseParcelNumber('st12')).toEqual({ kmen: 12, druh: 1 });
        expect(parseParcelNumber('abc')).toBeNull();
        expect(parseParcelNumber('0')).toBeNull();
        expect(parseParcelNumber('12/')).toBeNull();
    });

    it('labels parcels', () => {
        expect(parcelLabel(2, 12, 3)).toBe('12/3');
        expect(parcelLabel(1, 56)).toBe('st. 56');
    });

    it('normalizes an API parcel and ignores junk', () => {
        const view = normalizeParcel({
            id: 1234, typParcely: 'PKN', druhCislovaniParcely: 2, kmenoveCisloParcely: 123, poddeleniCislaParcely: 4,
            katastralniUzemi: { kod: 700001, nazev: 'Plzeň' }, vymera: 850,
            druhPozemku: { kod: 2, nazev: 'orná půda' }, zpusobVyuziti: { kod: 1, nazev: 'jiná plocha' },
            lv: { id: 9, cislo: 1500, katastralniUzemi: { kod: 700001, nazev: 'Plzeň' } },
            stavba: { id: 5, cislaDomovni: [12] },
            zpusobyOchrany: [{ kod: 1, nazev: 'památková zóna' }],
            rizeniPlomby: [{ id: 1, typRizeni: 'V', poradoveCislo: 7, rok: 2026, kodPracoviste: 101 }],
            bpej: [{ kod: 20110, vymera: 400 }],
        });
        expect(view).toMatchObject({ id: 1234, oznaceni: '123/4', vymera: 850, druhPozemku: 'orná půda', lv: { cislo: 1500, katastralniUzemi: 'Plzeň' }, stavba: 'č. p. 12', zpusobyOchrany: ['památková zóna'], plomby: [{ typ: 'V', cislo: '7/2026' }] });
        expect(normalizeParcel(null)).toBeNull();
        expect(normalizeParcel({ id: 'x' })).toBeNull();
    });

    it('searches territories by name or code, ignoring diacritics', () => {
        const list = [{ kod: 1, nazev: 'Plzeň' }, { kod: 2, nazev: 'Plzeňské Předměstí' }, { kod: 3, nazev: 'Kralovice' }, { kod: 700001, nazev: 'Lipno' }];
        expect(searchKu(list, 'plzen').map((k) => k.kod)).toEqual([1, 2]);
        expect(searchKu(list, '700001').map((k) => k.kod)).toEqual([700001]);
        expect(searchKu(list, 'ralov').map((k) => k.kod)).toEqual([3]);
        expect(searchKu(list, 'p')).toEqual([]);
    });
});

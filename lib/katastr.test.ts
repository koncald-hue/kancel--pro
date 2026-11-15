import { describe, expect, it } from 'vitest';
import { normalizeJednotka, normalizeParcel, normalizeRizeni, normalizeStavba, parcelLabel, parseParcelNumber, searchCastiObce, searchKu } from './katastr';

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

    it('normalizes a real response from the ČÚZK API', () => {
        const real = {"id": 582818405, "typParcely": "PKN", "druhCislovaniParcely": 2, "kmenoveCisloParcely": 100, "poddeleniCislaParcely": null, "katastralniUzemi": {"kod": 721981, "nazev": "Plzeň"}, "zdrojParcelyZE": null, "katastralniUzemiPuvodni": null, "dilParcely": null, "vymera": 347, "lv": {"id": 765129405, "cislo": 27197, "katastralniUzemi": {"kod": 721981, "nazev": "Plzeň"}}, "mapovyList": {"kod": 6780, "oznaceni": "DKM"}, "zpusobUrceniVymery": {"kod": 2, "nazev": "Ze souřadnic v S-JTSK"}, "druhPozemku": {"kod": 13, "nazev": "zastavěná plocha a nádvoří"}, "stavba": {"id": 272567405, "typStavby": {"kod": 1, "nazev": "budova s číslem popisným"}, "cislaDomovni": [327], "castObce": {"kod": 406392, "nazev": "Vnitřní Město"}}, "pravoStavby": null, "definicniBod": {"id": 28807405, "x": -822152.37, "y": -1069616.74}, "zpusobVyuziti": null, "zpusobyOchrany": [{"kod": 16, "nazev": "pam. rezervace - budova, pozemek v památkové rezervaci"}], "bpej": [], "rizeniPlomby": []};
        expect(normalizeParcel(real)).toEqual({
            id: 582818405, oznaceni: '100', katastralniUzemi: { kod: 721981, nazev: 'Plzeň' }, typ: 'PKN', stavebni: false, vymera: 347,
            druhPozemku: 'zastavěná plocha a nádvoří', zpusobVyuziti: '', lv: { cislo: 27197, katastralniUzemi: 'Plzeň' }, stavba: 'č. p. 327',
            zpusobyOchrany: ['pam. rezervace - budova, pozemek v památkové rezervaci'], plomby: [], bpej: [],
            mapovyList: 'DKM', zpusobUrceniVymery: 'Ze souřadnic v S-JTSK', souradnice: { x: -822152.37, y: -1069616.74 }, puvodniKu: '',
        });
    });

    it('searches territories by name or code, ignoring diacritics', () => {
        const list = [{ kod: 1, nazev: 'Plzeň' }, { kod: 2, nazev: 'Plzeňské Předměstí' }, { kod: 3, nazev: 'Kralovice' }, { kod: 700001, nazev: 'Lipno' }];
        expect(searchKu(list, 'plzen').map((k) => k.kod)).toEqual([1, 2]);
        expect(searchKu(list, '700001').map((k) => k.kod)).toEqual([700001]);
        expect(searchKu(list, 'ralov').map((k) => k.kod)).toEqual([3]);
        expect(searchKu(list, 'p')).toEqual([]);
    });

    it('normalizes buildings, units and proceedings', () => {
        const stavba = normalizeStavba({ id: 5, typStavby: { kod: 1, nazev: 'budova s číslem popisným' }, cislaDomovni: [327], castObce: { kod: 406392, nazev: 'Vnitřní Město' }, lv: { cislo: 9, katastralniUzemi: { kod: 1, nazev: 'Plzeň' } }, jednotky: [{ id: 1 }, { id: 2 }], parcely: [{ id: 10, druhCislovaniParcely: 1, kmenoveCisloParcely: 56, katastralniUzemi: { kod: 1, nazev: 'Plzeň' } }], docasna: false });
        expect(stavba).toMatchObject({ id: 5, cisla: '327', castObce: 'Vnitřní Město', pocetJednotek: 2, parcely: [{ id: 10, oznaceni: 'st. 56', katastralniUzemi: 'Plzeň' }], lv: { cislo: 9 } });
        expect(normalizeJednotka({ id: 7, cisloJednotky: 12, typJednotky: { kod: 1, nazev: 'byt' }, podilNaSpolecnychCastechDomu: { citatel: 15, jmenovatel: 1000 }, vymezenaVeStavbe: { typStavby: { kod: 1, nazev: 'budova' }, cislaDomovni: [12], castObce: { kod: 1, nazev: 'Centrum' } } })).toMatchObject({ cislo: 12, typ: 'byt', podil: '15/1000', stavba: 'budova č. p. 12, Centrum' });
        expect(normalizeRizeni({ id: 3, typRizeni: 'V', poradoveCislo: 1234, rok: 2026, kodPracoviste: 101, datumPrijeti: '2026-05-04T00:00:00', stav: 'Ukončeno', stavUhrady: 'U', navazanaRizeni: [{ typRizeni: 'Z', poradoveCislo: 5, rok: 2026 }], poznamky: ['pozn'] })).toMatchObject({ typNazev: 'Vklad', cislo: '1234/2026', datumPrijeti: '2026-05-04', stavUhrady: 'Uhrazeno', navazana: ['Záznam 5/2026'], poznamky: ['pozn'] });
        expect(normalizeStavba(null)).toBeNull();
    });

    it('searches parts of municipalities by name or municipality', () => {
        const list = [{ kod: 1, nazev: 'Vnitřní Město', obec: 'Plzeň' }, { kod: 2, nazev: 'Doubravka', obec: 'Plzeň' }, { kod: 3, nazev: 'Plzeňské Předměstí', obec: 'Hradec' }];
        expect(searchCastiObce(list, 'vnitrni').map((x) => x.kod)).toEqual([1]);
        expect(searchCastiObce(list, 'plzen').map((x) => x.kod)).toEqual([3, 1, 2]);
    });
});

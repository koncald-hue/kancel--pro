import { describe, expect, it } from 'vitest';
import { nice, normalizeRzp, normalizeVr } from './registers';

const vr = { zaznamy: [{ stavSubjektu: 'AKTIVNI', datumZapisu: '2003-08-26', datumAktualizace: '2026-07-24',
    spisovaZnacka: [{ datumZapisu: '2003-08-26', soud: 'MSPH', oddil: 'B', vlozka: 8573 }],
    zakladniKapital: [{ datumZapisu: '2003-08-26', vklad: { typObnos: 'KORUNY', hodnota: '2000000;00' }, splaceni: { typObnos: 'PROCENTA', hodnota: '100' } }],
    cinnosti: { predmetPodnikani: [{ datumZapisu: '2003-08-26', datumVymazu: '2010-02-23', hodnota: 'stará činnost' }, { datumZapisu: '2010-02-23', hodnota: 'výroba a obchod' }] },
    statutarniOrgany: [{ nazevOrganu: 'Představenstvo', zpusobJednani: [{ datumVymazu: '2008-06-11', hodnota: 'starý způsob' }, { hodnota: 'Za společnost jedná předseda samostatně.' }],
        clenoveOrganu: [{ datumVymazu: '2006-05-17', fyzickaOsoba: { jmeno: 'STARÝ', prijmeni: 'ČLEN' } }, { clenstvi: { funkce: { nazev: 'Předseda představenstva', vznikFunkce: '2022-08-15' } }, fyzickaOsoba: { jmeno: 'ONDŘEJ', prijmeni: 'NOVÁK-KRAMOLIŠ', titulPredJmenem: 'Ing.', adresa: { textovaAdresa: 'soukromá adresa' } } }, { clenstvi: { funkce: { nazev: 'Jednatel' } }, pravnickaOsoba: { obchodniJmeno: 'Firma s.r.o.', ico: '12345678' } }] }],
    spolecnici: [{ spolecnik: [{ datumVymazu: '2014-03-03', osoba: { fyzickaOsoba: { jmeno: 'A', prijmeni: 'B' } } }, { podil: [{ velikostPodilu: { typObnos: 'TEXT', hodnota: '100%' }, vklad: { hodnota: '200000' } }], osoba: { pravnickaOsoba: { obchodniJmeno: 'Matka a.s.', ico: '27082440' } } }] }] }] };

describe('registers', () => {
    it('keeps only current data and hides private addresses', () => {
        const r = normalizeVr(vr)!;
        expect(r.court).toBe('Městský soud v Praze, oddíl B, vložka 8573');
        expect(r.capital).toEqual({ amount: 2000000, paid: '100 %' });
        expect(r.activities).toEqual(['výroba a obchod']);
        expect(r.organs[0]).toMatchObject({ name: 'Představenstvo', rules: 'Za společnost jedná předseda samostatně.' });
        expect(r.organs[0].members.map((m) => m.name)).toEqual(['Ing. Ondřej Novák-Kramoliš', 'Firma s.r.o. (IČO 12345678)']);
        expect(JSON.stringify(r)).not.toContain('soukromá adresa');
        expect(r.partners).toHaveLength(1);
        expect(r.partners[0].name).toBe('Matka a.s. (IČO 27082440)');
        expect(r.partners[0].share.replace(/\s+/g, ' ')).toBe('100%, vklad 200 000 Kč');
    });
    it('turns capitalised names into normal case', () => { expect(nice('SAMEER SOOD')).toBe('Sameer Sood'); expect(nice('Jan Novák')).toBe('Jan Novák'); expect(nice('NOVÁK-KRAMOLIŠ')).toBe('Novák-Kramoliš'); });
    it('summarises trades with active and ended counts', () => {
        const z = normalizeRzp({ zaznamy: [{ zivnostiStav: { pocetAktivnich: 1, pocetZaniklych: 1, pocetPozastavenych: 0 }, provozovnyStav: { pocetAktivnich: 3 }, zivnosti: [
            { datumVzniku: '2003-08-26', predmetPodnikani: 'Výroba, obchod a služby', druhZivnosti: 'L', oboryCinnosti: [{ oborNazev: 'Reklamní činnost' }], odpovedniZastupci: [{ jmeno: 'JITKA', prijmeni: 'ŽENATOVÁ', platnostDo: '2016-09-01' }, { jmeno: 'NELA', prijmeni: 'SKÁLOVÁ' }] },
            { datumVzniku: '2011-01-01', datumZaniku: '2017-03-01', predmetPodnikani: 'Zprostředkování úvěru', druhZivnosti: 'V' }] }] })!;
        expect(z).toMatchObject({ active: 1, ended: 1, suspended: 0, offices: 3 });
        expect(z.trades[0]).toMatchObject({ type: 'Volná', fields: ['Reklamní činnost'], reps: ['Nela Skálová'] });
        expect(z.trades[1].ended).toBe('2017-03-01');
    });
    it('returns null for an empty answer', () => { expect(normalizeVr({})).toBeNull(); expect(normalizeRzp({ zaznamy: [] })).toBeNull(); });
});

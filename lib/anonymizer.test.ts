import { describe, expect, it } from 'vitest';
import { anonymizeText, restoreText, suggestNames } from './anonymizer';

describe('anonymizeText', () => {
    it('zakryje identifikátory a stejnou hodnotu pojmenuje stejně', () => {
        const r = anonymizeText('Rodné číslo 800101/1234, účet 123456789/0800, e-mail jan@novak.cz, tel. 777 123 456. Znovu jan@novak.cz.');
        expect(r.text).not.toMatch(/800101|123456789|jan@novak|777 123/);
        expect(r.text.match(/\[E-mail 1\]/g)).toHaveLength(2);
        expect(r.counts['Rodné číslo']).toBe(1);
    });
    it('jména skloňuje a celé jméno i příjmení dostanou stejnou značku', () => {
        const r = anonymizeText('Jan Novák podal žalobu. Žalovaný dluží panu Novákovi 5000 Kč a Janu Novákovi.', ['Jan Novák']);
        expect(r.text).not.toMatch(/Novák|Jan /);
        expect(new Set(r.text.match(/\[Osoba \d\]/g))).toEqual(new Set(['[Osoba 1]']));
    });
    it('rozliší různé osoby', () => {
        const r = anonymizeText('Petr Svoboda žaluje Marii Dvořákovou.', ['Petr Svoboda', 'Marie Dvořáková']);
        expect(r.text).toContain('[Osoba 1]'); expect(r.text).toContain('[Osoba 2]');
    });
    it('číslo spisu a běžná čísla nechá být', () => {
        const r = anonymizeText('sp. zn. 12 C 345/2024, částka 150 000 Kč, rok 2024');
        expect(r.text).toBe('sp. zn. 12 C 345/2024, částka 150 000 Kč, rok 2024');
    });
    it('adresu zakryje', () => {
        expect(anonymizeText('bytem Dlouhá 12, 110 00 Praha 1.').text).toContain('[Adresa 1]');
    });
    it('vrací zpět do původního stavu', () => {
        const src = 'Jan Novák, jan@novak.cz, nar. 1. 1. 1980.';
        const r = anonymizeText(src, ['Jan Novák']);
        expect(restoreText(r.text, r.map)).toBe(src);
        expect(restoreText('Pane [Osoba 1], [Osoba 9]', r.map)).toBe('Pane Jan Novák, [Osoba 9]');
    });
});

describe('suggestNames', () => {
    it('navrhne dvojice velkých slov, ne města', () => {
        const s = suggestNames('Smlouvu uzavřel Jan Novák v Praze. Poté Jan Novák odjel do Brna.');
        expect(s).toContain('Jan Novák');
    });
});

describe('adresa a jména na začátku věty', () => {
    it('adresu zakryje celou včetně čísla obvodu', () => {
        expect(anonymizeText('bytem Dlouhá 12, 110 00 Praha 1, a dál').text).toBe('bytem [Adresa 1], a dál');
    });
    it('nabídne jméno i na začátku věty', () => {
        expect(suggestNames('Jan Novák podal žalobu.')).toContain('Jan Novák');
    });
});

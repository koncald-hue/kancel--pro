import { describe, expect, it } from 'vitest';
import { anonymize, judikaturaSources, lawSearchSources, provisionSource, validateEvaluation, type Source } from './legalResearch';

describe('anonymize', () => {
    it('removes contact data and personal identifiers', () => {
        const { text, replaced } = anonymize('Volejte +420 777 123 456 nebo pište jan@firma.cz. RČ 800101/1234, IČO: 27082440, účet 123456789/0100, nar. 1. 1. 1980.');
        expect(text).not.toMatch(/777|jan@|800101|27082440|123456789|1980/);
        expect(text).toContain('[telefon]');
        expect(Object.keys(replaced)).toEqual(expect.arrayContaining(['e-maily', 'rodná čísla', 'IČO', 'čísla účtů', 'telefony']));
    });
    it('replaces declined forms of known names but keeps ordinary words', () => {
        const { text } = anonymize('Jan Novák podal žalobu. Novákovi soud vyhověl a Nováka zastupoval advokát.', [{ name: 'JUDr. Jan Novák', label: 'klient' }]);
        expect(text).not.toMatch(/Novák/);
        expect(text).toContain('[klient]');
        expect(text).toContain('soud vyhověl');
    });
});

const DECISIONS = { success: true, results: [{ spzn: '28 Cdo 3275/2024', date: '2024-12-17T00:00:00', collection: 'cz_ns', url: 'https://www.directcase.ai/app/doc/cz_ns/1', chunks: ['Podle § 621 o. z. okolnosti <mark>rozhodné</mark> pro počátek běhu.', 'Druhý úryvek.'] }, { spzn: '28 Cdo 3275/2024', chunks: ['duplicita'] }, { spzn: '25 Cdo 1/2007', collection: 'cz_ns', url: 'https://evil.example/x', chunks: [] }] };

describe('sources', () => {
    it('normalises decisions, removes marks and duplicates and unsafe links', () => {
        const s = judikaturaSources(DECISIONS);
        expect(s.map((x) => x.id)).toEqual(['S1', 'S2']);
        expect(s[0]).toMatchObject({ title: '28 Cdo 3275/2024', court: 'Nejvyšší soud', date: '2024-12-17', url: 'https://www.directcase.ai/app/doc/cz_ns/1' });
        expect(s[0].excerpts[0]).toBe('Podle § 621 o. z. okolnosti rozhodné pro počátek běhu.');
        expect(s[1].url).toBe('');
    });
    it('reads provisions and rejects non-existent ones', () => {
        expect(provisionSource({ exists: true, cite_path: '§ 621 89/2012 Sb.', text: 'Subjektivní lhůta…', source_url: 'https://www.e-sbirka.cz/x' }, 'S5')?.title).toContain('§ 621');
        expect(provisionSource({ exists: false }, 'S6')).toBeNull();
        expect(lawSearchSources({ results: [{ citation: '§ 2910 89/2012 Sb.', text: 'Kdo způsobí újmu…' }] }, 7)[0].id).toBe('S7');
    });
});

describe('validateEvaluation', () => {
    const sources: Source[] = [{ id: 'S1', kind: 'judikatura', title: 'A', url: '', excerpts: ['Subjektivní promlčecí lhůta počíná běžet dnem, kdy se oprávněný dozvěděl o obohacení.'] }];
    it('drops invented sources, marks unsupported arguments and verifies quotes', () => {
        const ev = validateEvaluation({
            summary: 'Shrnutí',
            arguments: [{ stance: 'pro', claim: 'Lhůta ještě neběží', explanation: 'x', sources: ['S1', 'S9'], strength: 'silný' }, { stance: 'proti', claim: 'Bez opory', explanation: 'y', sources: ['S9'] }],
            caselaw: [{ source: 'S1', relevance: 'vysoká', why: 'sedí', quote: 'počíná běžet dnem, kdy se oprávněný dozvěděl o obohacení' }, { source: 'S1', relevance: 'nízká', why: 'a', quote: 'vymyšlená citace, která ve zdroji není' }, { source: 'S7', why: 'neexistuje', quote: '' }],
            risks: ['r'],
        }, sources);
        expect(ev.arguments[0]).toMatchObject({ sources: ['S1'], unsupported: false });
        expect(ev.arguments[1].unsupported).toBe(true);
        expect(ev.caselaw).toHaveLength(2);
        expect(ev.caselaw[0].quote).not.toBe('');
        expect(ev.caselaw[1].quote).toBe('');
    });
    it('survives garbage input', () => {
        expect(validateEvaluation('nic', sources).arguments).toEqual([]);
    });
});

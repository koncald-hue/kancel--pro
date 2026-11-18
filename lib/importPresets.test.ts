import { describe, expect, it } from 'vitest';
import { guessPreset, suggestWithPreset } from './importPresets';

describe('import presets', () => {
    it('maps preset-specific column names that generic synonyms miss', () => {
        const h = ['Spis nazev', 'Cislo spisu soudu', 'Soud organ', 'Klient spisu', 'Stav spisu'];
        const auto = suggestWithPreset('veci', h, 'auto');
        const evolio = suggestWithPreset('veci', h, 'evolio');
        expect(evolio).toEqual(['title', 'reference', 'authority', 'client', 'status']);
        expect(auto.filter(Boolean).length).toBeLessThan(evolio.filter(Boolean).length);
    });
    it('maps English SingleCase-style time columns', () => {
        expect(suggestWithPreset('cas', ['Matter', 'Date', 'Hours', 'Narrative', 'Hourly rate', 'Invoiced'], 'singlecase')).toEqual(['case', 'date', 'hours', 'description', 'rate', 'billed']);
    });
    it('falls back to generic synonyms and never maps one field twice', () => {
        const m = suggestWithPreset('klienti', ['Jméno', 'Příjmení', 'E-mail', 'Telefon', 'E-mail'], 'evolio');
        expect(m.filter((x) => x === 'email')).toHaveLength(1);
        expect(m).toContain('first'); expect(m).toContain('last');
    });
    it('suggests a preset only on at least three specific matches', () => {
        expect(guessPreset('veci', ['Spis nazev', 'Cislo spisu soudu', 'Soud organ', 'Klient spisu'])).toBe('evolio');
        expect(guessPreset('veci', ['Název', 'Soud', 'Klient'])).toBeNull();
    });
});

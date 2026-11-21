import { describe, expect, it } from 'vitest';
import { pageOnly, validateFeedback } from './feedback';

describe('validateFeedback', () => {
    it('přijme platnou zprávu', () => expect(validateFeedback({ kind: 'problem', message: 'Nejde mi nahrát soubor.' })).toBeNull());
    it('odmítne krátkou a neznámý druh', () => {
        expect(validateFeedback({ kind: 'problem', message: 'ahoj' })).toMatch(/alespoň/);
        expect(validateFeedback({ kind: 'x', message: 'dost dlouhá zpráva' })).toMatch(/Vyberte/);
        expect(validateFeedback({ kind: 'jine', message: 'a'.repeat(2001) })).toMatch(/nejvýše/);
    });
});
describe('pageOnly', () => {
    it('odstraní parametry a identifikátor spisu', () => expect(pageOnly('/kancelar/veci/756070e5-f9b8-4307-b150-d4755e981426?x=1#a')).toBe('/kancelar/veci/:id'));
});

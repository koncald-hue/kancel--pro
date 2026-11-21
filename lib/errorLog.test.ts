import { describe, expect, it } from 'vitest';
import { fingerprint, isNoise, pagePath, scrub } from './errorLog';

describe('scrub', () => {
    it('odstraní e-mail, identifikátor, klíč a parametry', () => {
        const t = scrub('Chyba u jan@firma.cz ve spisu 756070e5-f9b8-4307-b150-d4755e981426 token abcdefghijklmnopqrstuvwxyz123456 na https://x.cz/a?id=5&t=zzz', 500);
        expect(t).not.toMatch(/jan@firma/); expect(t).toContain(':email'); expect(t).toContain(':id'); expect(t).toContain(':token'); expect(t).toContain('https://x.cz/a'); expect(t).not.toContain('id=5');
    });
    it('zkrátí', () => expect(scrub('ab '.repeat(300), 500)).toHaveLength(500));
});
describe('pagePath', () => it('bez parametrů a id', () => expect(pagePath('/kancelar/veci/756070e5-f9b8-4307-b150-d4755e981426?x=1')).toBe('/kancelar/veci/:id')));
describe('isNoise', () => {
    it('šum se ignoruje', () => { expect(isNoise('ResizeObserver loop completed with undelivered notifications.')).toBe(true); expect(isNoise('Script error.')).toBe(true); expect(isNoise('TypeError: Failed to fetch')).toBe(true); expect(isNoise('x', 'at chrome-extension://abc/a.js')).toBe(true); });
    it('skutečná chyba ne', () => expect(isNoise("TypeError: Cannot read properties of undefined (reading 'id')")).toBe(false));
});
describe('fingerprint', () => it('stejná chyba na stejné stránce', () => expect(fingerprint('Chyba', '/kancelar')).toBe(fingerprint('Chyba', '/kancelar'))));

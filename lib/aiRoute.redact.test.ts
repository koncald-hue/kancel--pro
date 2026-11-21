import { describe, expect, it } from 'vitest';
import { redact } from './redact';
import { buildRoutePrompt } from './aiRoute';

describe('aiRoute + redact', () => {
    it('číslování spisů zůstane po zakrytí identifikátorů čitelné', () => {
        const p = buildRoutePrompt({ subject: 'Re: 12 C 5/2026', text: 'Volejte 777 123 456 nebo jan@firma.cz' }, [{ id: 'a', title: 'Novák proti Dvořákovi' }, { id: 'b', title: 'Pokuta' }]);
        const r = redact(p.text).text;
        expect(r).toContain('1. Novák proti Dvořákovi'); expect(r).toContain('2. Pokuta');
        expect(r).not.toContain('777 123 456'); expect(r).not.toContain('jan@firma.cz');
    });
});

import { describe, expect, it } from 'vitest';
import { safeUrl, safeWebsite } from './safeUrl';

describe('safeUrl', () => {
    it('allows http and https only', () => {
        expect(safeUrl('https://isir.justice.cz/x?a=1')).toBe('https://isir.justice.cz/x?a=1');
        expect(safeUrl('http://example.cz')).toBe('http://example.cz/');
        for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x', '//evil.example', '/relative', '', null, 42]) expect(safeUrl(bad)).toBeUndefined();
    });
    it('completes bare websites but never other schemes', () => {
        expect(safeWebsite('www.kancelar.cz')).toBe('https://www.kancelar.cz/');
        expect(safeWebsite('javascript:alert(1)')).toBeUndefined();
        expect(safeWebsite('https://a.cz')).toBe('https://a.cz/');
    });
});

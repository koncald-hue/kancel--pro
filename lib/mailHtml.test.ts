import { describe, expect, it } from 'vitest';
import { htmlFromText } from './mailHtml';

describe('htmlFromText', () => {
    it('obsahuje značku, odstavce a klikací odkaz', () => {
        const h = htmlFromText('Dobrý den,\n\nodkaz: https://kancelarpro.cz/kancelar/veci.\n\nKancelář Pro');
        expect(h).toContain('/pwa-icon/stamp-128');
        expect((h.match(/<p /g) ?? []).length).toBeGreaterThanOrEqual(3);
        expect(h).toContain('href="https://kancelarpro.cz/kancelar/veci"');
    });
    it('neprovede vložený HTML kód', () => expect(htmlFromText('<script>alert(1)</script>')).not.toContain('<script>'));
});

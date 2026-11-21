import { describe, expect, it } from 'vitest';
import { htmlFromText } from './mailHtml';

describe('htmlFromText', () => {
    it('obsahuje značku, odstavce a patičku', () => {
        const h = htmlFromText('Dobrý den,\n\nvítejte v programu.\n\nKancelář Pro');
        expect(h).toContain('/pwa-icon/stamp-128'); expect(h).toContain('KANCELÁŘ PRO'); expect(h).toContain('můžete ji ignorovat');
        expect((h.match(/<p style/g) ?? []).length).toBeGreaterThanOrEqual(3);
    });
    it('samostatný odkaz je tlačítko, odkaz ve větě zůstane odkazem', () => {
        const h = htmlFromText('Dobrý den,\n\nzkuste to tady: https://kancelarpro.cz/a.\n\nhttps://kancelarpro.cz/kancelar/veci');
        expect(h).toContain('Otevřít v Kanceláři Pro');
        expect(h).toContain('href="https://kancelarpro.cz/a"');
    });
    it('kód se zvýrazní', () => expect(htmlFromText('Dobrý den,\n\nkód pro otevření je: 482913')).toContain('letter-spacing:8px'));
    it('neprovede vložený HTML kód', () => expect(htmlFromText('<script>alert(1)</script>')).not.toContain('<script>'));
    it('předtext (preheader) je první věcná věta', () => expect(htmlFromText('Dobrý den,\n\nVaše lhůta se blíží.')).toContain('Vaše lhůta se blíží.'));
});

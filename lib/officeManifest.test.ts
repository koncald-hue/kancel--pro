import { describe, expect, it } from 'vitest';
import { buildManifest, isHttpsOrigin } from './officeManifest';

describe('officeManifest', () => {
    it('Word manifest míří na stránku doplňku a má právo číst i zapisovat dokument', () => {
        const x = buildManifest('word', 'https://kancelar.cz', 'abc');
        expect(x).toContain('xsi:type="TaskPaneApp"'); expect(x).toContain('https://kancelar.cz/doplnek/word'); expect(x).toContain('ReadWriteDocument'); expect(x).toContain('<Id>abc</Id>');
    });
    it('Outlook manifest je jen pro čtení zprávy', () => {
        const x = buildManifest('outlook', 'https://kancelar.cz', 'abc');
        expect(x).toContain('xsi:type="MailApp"'); expect(x).toContain('<Permissions>ReadItem</Permissions>'); expect(x).toContain('/doplnek/outlook');
    });
    it('bez https se odmítne', () => {
        expect(isHttpsOrigin('http://localhost:3001')).toBe(false); expect(isHttpsOrigin('https://a.cz/')).toBe(false);
        expect(() => buildManifest('word', 'http://x.cz', 'a')).toThrow(/https/);
    });
});

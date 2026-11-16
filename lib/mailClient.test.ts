import { describe, expect, it } from 'vitest';
import { b64ToBytes, quoted, safeHtml } from './mailClient';

describe('mail client helpers', () => {
    it('wraps HTML in a document that blocks scripts and remote content', () => {
        const d = safeHtml('<p>Ahoj</p><img src="https://track.example/x.gif">');
        expect(d).toContain("default-src 'none'"); expect(d).toContain("img-src data:"); expect(d).toContain('<base target="_blank">');
    });
    it('quotes the original text for a reply', () => {
        const q = quoted({ from: 'Jan <j@x.cz>', date: '2026-11-16T10:00:00Z', text: 'Řádek 1\nŘádek 2' });
        expect(q).toContain('napsal(a) Jan <j@x.cz>'); expect(q).toContain('> Řádek 1'); expect(q).toContain('> Řádek 2');
    });
    it('decodes base64 attachments', () => { expect(Array.from(b64ToBytes('QUJD'))).toEqual([65, 66, 67]); });
});

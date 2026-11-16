import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { docxXmlToText, extOf, extractText, isExtractable } from './docText';

const XML = '<w:document><w:body><w:p><w:r><w:t>Žalobce &amp; spol.</w:t></w:r><w:r><w:tab/><w:t>dluží 5 000 Kč</w:t></w:r></w:p><w:p><w:r><w:t>Druhý odstavec.</w:t></w:r></w:p></w:body></w:document>';

describe('document text extraction', () => {
    it('recognises supported types', () => {
        expect(['a.PDF', 'b.docx', 'c.txt', 'd.png'].map(isExtractable)).toEqual([true, true, true, false]);
        expect(extOf('x.tar.gz')).toBe('gz');
    });
    it('turns Word XML into plain text', () => {
        expect(docxXmlToText(XML)).toBe('Žalobce & spol.\tdluží 5 000 Kč\nDruhý odstavec.');
    });
    it('extracts text from txt and docx files and limits the length', async () => {
        const txt = await extractText(new Blob(['Toto je dostatečně dlouhý text smlouvy o dílo.'], { type: 'text/plain' }), 'smlouva.txt', 20);
        expect(txt).toEqual({ ok: true, text: 'Toto je dostatečně d', truncated: true });
        const zip = new JSZip(); zip.file('word/document.xml', XML);
        const docx = await extractText(await zip.generateAsync({ type: 'blob' }), 'a.docx');
        expect(docx.ok && docx.text).toContain('Žalobce & spol.');
    });
    it('reports files without text or of unsupported type', async () => {
        expect((await extractText(new Blob(['krátké']), 'a.txt')).ok).toBe(false);
        const img = await extractText(new Blob(['x']), 'foto.jpg');
        expect(img.ok).toBe(false);
    });
});

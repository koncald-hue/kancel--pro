// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { bodyXml, buildRichDocx, runs } from './docx';

const load = async (blob: Blob) => JSZip.loadAsync(await new Promise<ArrayBuffer>((res) => { const f = new FileReader(); f.onload = () => res(f.result as ArrayBuffer); f.readAsArrayBuffer(blob); }));

describe('docx builder', () => {
    it('produces well-formed XML parts with footer page numbers, styles and Czech language', async () => {
        const zip = await load(await buildRichDocx('# Smlouva & spol.\n\n## I. Předmět\n1. Text s **tučným** <písmem>\n1.1 Podbod\na) písmeno\n- odrážka\n| A | B |\n| 1 | 2 |\n::podpisy Klient | Advokát\n>> V Plzni dne 1. 1. 2026\n::strana\nKonec'));
        for (const name of ['word/document.xml', 'word/styles.xml', 'word/footer1.xml', 'word/settings.xml', '[Content_Types].xml', 'docProps/core.xml']) {
            const xml = await zip.file(name)!.async('string');
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            expect(doc.getElementsByTagName('parsererror').length, name).toBe(0);
        }
        const body = await zip.file('word/document.xml')!.async('string');
        expect(body).toContain('w:pStyle w:val="Title"'); expect(body).toContain('Smlouva &amp; spol.'); expect(body).toContain('&lt;písmem&gt;');
        expect(body).toContain('<w:b/>'); expect(body).toContain('w:pStyle w:val="Odstavec1"'); expect(body).toContain('w:pStyle w:val="Odstavec2"'); expect(body).toContain('w:pStyle w:val="Pismeno"');
        expect(body).toContain('<w:tbl>'); expect(body).toContain('w:br w:type="page"'); expect(body).toContain('footerReference');
        expect(await zip.file('word/footer1.xml')!.async('string')).toContain('NUMPAGES');
        expect(await zip.file('word/styles.xml')!.async('string')).toContain('cs-CZ');
        expect(await zip.file('docProps/core.xml')!.async('string')).toContain('<dc:title>Smlouva &amp; spol.</dc:title>');
    });
    it('keeps plain text lines as normal paragraphs and collapses repeated blank lines', () => {
        const xml = bodyXml('První\n\n\n\nDruhý');
        expect((xml.match(/<w:p>/g) ?? []).length).toBe(3);
        expect(runs('a **b** c')).toContain('<w:b/>');
    });
});

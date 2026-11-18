import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { CaseFile } from './caseFile';
import { findSameName, groupVersions, nextVersionInfo } from './fileVersions';
import { docxXmlToText, extractText, htmlToText } from './fileText';

const f = (id: string, name: string, over: Partial<CaseFile> = {}): CaseFile => ({ id, case_id: 'c', folder_id: null, name, path: id, size: 1, mime: '', note: '', created_at: `2030-01-0${id.length}T00:00:00Z`, version: 1, version_of: null, ...over } as CaseFile);

describe('file versions', () => {
    const v1 = f('a', 'smlouva.docx', { created_at: '2030-01-01T00:00:00Z' });
    const v2 = f('b', 'smlouva.docx', { version: 2, version_of: 'a', created_at: '2030-01-05T00:00:00Z' });
    const v3 = f('c', 'smlouva.docx', { version: 3, version_of: 'a', created_at: '2030-01-09T00:00:00Z' });
    const other = f('d', 'plna-moc.pdf', { created_at: '2030-01-07T00:00:00Z' });
    it('groups versions and picks the newest as latest', () => {
        const g = groupVersions([v1, v2, other, v3]);
        expect(g).toHaveLength(2);
        expect(g[0].latest.id).toBe('c'); expect(g[0].older.map((x) => x.id)).toEqual(['b', 'a']);
        expect(g[1].latest.id).toBe('d');
    });
    it('finds a same-named file in the same folder and numbers the next version', () => {
        expect(findSameName([v1, v2, other], null, 'Smlouva.DOCX')?.id).toBe('b');
        expect(findSameName([v1], 'folder', 'smlouva.docx')).toBeNull();
        expect(findSameName([f('e', 'x.txt', { enc: true })], null, 'x.txt')).toBeNull();
        expect(nextVersionInfo([v1, v2], v2)).toEqual({ version_of: 'a', version: 3 });
        expect(nextVersionInfo([other], other)).toEqual({ version_of: 'd', version: 2 });
    });
});

describe('text extraction', () => {
    it('reads plain text and strips html', async () => {
        const enc = new TextEncoder();
        expect(await extractText('poznamky.txt', enc.encode('Žaloba o zaplacení 125 000 Kč').buffer as ArrayBuffer)).toContain('Žaloba o zaplacení');
        expect(htmlToText('<p>Dobrý&nbsp;den</p><script>x()</script><p>A &amp; B</p>')).toBe('Dobrý den\nA & B');
    });
    it('reads docx text from word/document.xml', async () => {
        const zip = new JSZip(); zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Smlouva o dílo</w:t></w:r></w:p><w:p><w:r><w:t>Cena 50 000 Kč</w:t></w:r></w:p></w:body></w:document>');
        const bytes = await zip.generateAsync({ type: 'arraybuffer' });
        expect(await extractText('smlouva.docx', bytes)).toBe('Smlouva o dílo\nCena 50 000 Kč');
        expect(docxXmlToText('<w:p><w:r><w:t>a</w:t></w:r></w:p>')).toBe('a');
    });
    it('skips pdf, big and broken files', async () => {
        expect(await extractText('sken.pdf', new ArrayBuffer(10))).toBeNull();
        expect(await extractText('rozbity.docx', new TextEncoder().encode('neni zip').buffer as ArrayBuffer)).toBeNull();
    });
});

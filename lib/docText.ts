import JSZip from 'jszip';

// Text ze souborů spisu, vše v prohlížeči (soubor se nikam neposílá). Podporováno: txt, md, csv, docx, pdf s textovou vrstvou.
export const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'docx', 'pdf'];
export const MAX_DOC_CHARS = 8000;
export const MAX_TOTAL_CHARS = 24000;

export const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
export const isExtractable = (name: string) => TEXT_EXTENSIONS.includes(extOf(name));

const decode = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Z word/document.xml: odstavce, tabulátory a zalomení, texty z <w:t>
export function docxXmlToText(xml: string): string {
    return decode(xml
        .replace(/<w:tab\s*\/>/g, '\t')
        .replace(/<w:br\s*\/>|<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const readBlob = (blob: Blob) => new Promise<ArrayBuffer>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.onerror = () => reject(new Error('Soubor se nepodařilo načíst.')); r.readAsArrayBuffer(blob); });

export type Extracted = { ok: true; text: string; truncated: boolean } | { ok: false; reason: string };

export async function extractText(blob: Blob, name: string, maxChars = MAX_DOC_CHARS): Promise<Extracted> {
    const ext = extOf(name);
    let text = '';
    try {
        if (ext === 'txt' || ext === 'md' || ext === 'csv') text = new TextDecoder('utf-8').decode(new Uint8Array(await readBlob(blob)));
        else if (ext === 'docx') {
            const zip = await JSZip.loadAsync(await readBlob(blob));
            const xml = await zip.file('word/document.xml')?.async('string');
            if (!xml) return { ok: false, reason: 'Soubor Word nemá čitelný obsah.' };
            text = docxXmlToText(xml);
        } else if (ext === 'pdf') {
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
            const doc = await pdfjs.getDocument({ data: new Uint8Array(await readBlob(blob)) }).promise;
            const parts: string[] = [];
            for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
                const page = await doc.getPage(i);
                const content = await page.getTextContent();
                parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
                if (parts.join('\n').length > maxChars * 2) break;
            }
            text = parts.join('\n');
        } else return { ok: false, reason: 'Tento typ souboru zatím nejde přečíst (podporováno: txt, Word, PDF s textem).' };
    } catch { return { ok: false, reason: 'Soubor se nepodařilo přečíst.' }; }
    text = text.replace(/\u0000/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 20) return { ok: false, reason: 'V souboru se nenašel žádný text (možná jde o sken bez rozpoznaného textu).' };
    return { ok: true, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}

import JSZip from 'jszip';

// Text ze souboru pro vyhledávání. Zvládne prostý text, CSV, Markdown, HTML a DOCX. U PDF a skenů se text nevytahuje.
export const INDEXABLE = /\.(txt|csv|md|html?|docx)$/i;
export const MAX_INDEX_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_CHARS = 250_000;

const decodeEntities = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
export const htmlToText = (html: string) => decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|li|tr|h\d|br)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n\s*\n+/g, '\n').trim();
export function docxXmlToText(xml: string): string {
    return decodeEntities(xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n\s*\n+/g, '\n').trim();
}

export async function extractText(name: string, bytes: ArrayBuffer): Promise<string | null> {
    if (!INDEXABLE.test(name) || bytes.byteLength > MAX_INDEX_BYTES) return null;
    try {
        let text = '';
        if (/\.docx$/i.test(name)) { const zip = await JSZip.loadAsync(bytes); const doc = zip.file('word/document.xml'); if (!doc) return null; text = docxXmlToText(await doc.async('string')); }
        else { const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes); text = /\.html?$/i.test(name) ? htmlToText(raw) : raw; }
        text = text.replace(/\u0000/g, '').trim();
        return text.length >= 3 ? text.slice(0, MAX_TEXT_CHARS) : null;
    } catch { return null; }
}

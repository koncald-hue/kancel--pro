// Text z PDF a obrázků pro hledání v obsahu spisu. Vše běží v prohlížeči, soubor se nikam neposílá.
// 1) PDF s textovou vrstvou: text se přečte přímo. 2) Sken (strana bez textu) nebo obrázek: rozpoznání textu (OCR, česky)
// přes tesseract.js, jehož soubory a jazyková data se servírují z vlastní domény (/ocr). OCR je pomalé (zhruba pár sekund na stranu).
// Šifrované soubory (šifrování Kanceláře) se neindexují vůbec; PDF chráněné heslem se přeskočí.
import { MAX_TEXT_CHARS } from './fileText';

export const PDF_RE = /\.pdf$/i;
export const IMAGE_RE = /\.(png|jpe?g)$/i;
export const MAX_PDF_BYTES = 30 * 1024 * 1024;
export const MAX_OCR_PAGES = 40;
const MIN_PAGE_TEXT = 25; // strana s menším množstvím textu se považuje za sken

export const needsOcr = (pageText: string) => pageText.replace(/\s+/g, '').length < MIN_PAGE_TEXT;
export const cleanOcr = (t: string) => t.replace(/\u0000/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

export type PdfResult =
    | { ok: true; text: string; pages: number; ocrPages: number; scanned: boolean }
    | { ok: false; reason: 'encrypted' | 'too_big' | 'unreadable' | 'needs_ocr' };

type Progress = (p: { page: number; pages: number; phase: 'text' | 'ocr' }) => void;
type Worker = { recognize: (img: HTMLCanvasElement | Blob) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

async function ocrWorker(): Promise<Worker> {
    const { createWorker } = await import('tesseract.js');
    return (await createWorker('ces', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', gzip: true })) as unknown as Worker;
}

export async function extractPdf(bytes: ArrayBuffer, opts: { ocr: boolean; onProgress?: Progress }): Promise<PdfResult> {
    if (bytes.byteLength > MAX_PDF_BYTES) return { ok: false, reason: 'too_big' };
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    let doc;
    try { doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise; }
    catch (e) { return { ok: false, reason: (e as { name?: string })?.name === 'PasswordException' ? 'encrypted' : 'unreadable' }; }
    const parts: string[] = []; const scanPages: number[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
        opts.onProgress?.({ page: i, pages: doc.numPages, phase: 'text' });
        const content = await (await doc.getPage(i)).getTextContent();
        const t = content.items.map((it) => ('str' in it ? it.str : '')).join(' ');
        parts[i - 1] = t; if (needsOcr(t)) scanPages.push(i);
        if (parts.join('\n').length > MAX_TEXT_CHARS) break;
    }
    let ocrPages = 0;
    if (scanPages.length && !opts.ocr && parts.join('').replace(/\s+/g, '').length < MIN_PAGE_TEXT) { await doc.destroy(); return { ok: false, reason: 'needs_ocr' }; }
    if (scanPages.length && opts.ocr) {
        const worker = await ocrWorker();
        try {
            for (const n of scanPages.slice(0, MAX_OCR_PAGES)) {
                opts.onProgress?.({ page: n, pages: doc.numPages, phase: 'ocr' });
                const page = await doc.getPage(n); const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
                parts[n - 1] = ((await worker.recognize(canvas)).data.text ?? ''); ocrPages++;
                canvas.width = 0; canvas.height = 0;
            }
        } finally { await worker.terminate(); }
    }
    await doc.destroy();
    const text = cleanOcr(parts.join('\n\n')).slice(0, MAX_TEXT_CHARS);
    return text.length >= 3 ? { ok: true, text, pages: doc.numPages, ocrPages, scanned: scanPages.length > 0 } : { ok: false, reason: scanPages.length ? 'needs_ocr' : 'unreadable' };
}

// Obrázek (sken, fotka dokumentu) přes OCR; jeden pracovní proces pro více souborů šetří čas
export async function ocrImages(files: { id: string; bytes: ArrayBuffer; name: string }[], onEach?: (done: number, total: number) => void): Promise<Map<string, string>> {
    const out = new Map<string, string>(); if (!files.length) return out;
    const worker = await ocrWorker();
    try {
        let n = 0;
        for (const f of files) {
            try { const t = cleanOcr((await worker.recognize(new Blob([f.bytes], { type: /png$/i.test(f.name) ? 'image/png' : 'image/jpeg' }))).data.text ?? ''); if (t.length >= 3) out.set(f.id, t.slice(0, MAX_TEXT_CHARS)); } catch { /* další soubor */ }
            onEach?.(++n, files.length);
        }
    } finally { await worker.terminate(); }
    return out;
}

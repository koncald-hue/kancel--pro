import { PDFDocument } from 'pdf-lib';

// Smlouva jako PDF: text se kreslí přes plátno prohlížeče (základní písma PDF neumí češtinu), stránky se skládají do PDF.
const W = 1240; const H = 1754; const PAD = 100; const LINE = 38;

export type LineStyle = { font: string; height: number };
export const styleOf = (line: string, index: number): LineStyle => index === 0 ? { font: 'bold 42px sans-serif', height: 60 } : /^[IVX]+\. /.test(line) ? { font: 'bold 28px sans-serif', height: 46 } : { font: '25px sans-serif', height: LINE };

// Rozdělí text na stránky (každá stránka je seznam řádků s písmem); měří přes dodané plátno
export function paginate(lines: string[], measure: (text: string, font: string) => number, maxWidth = W - PAD * 2, pageHeight = H - PAD * 2): { text: string; font: string; y: number }[][] {
    const pages: { text: string; font: string; y: number }[][] = [[]]; let y = 0;
    lines.forEach((l, i) => {
        const s = styleOf(l, i);
        if (!l) { y += 14; return; }
        const rows: string[] = []; let cur = '';
        for (const w of l.split(' ')) { const t = cur ? `${cur} ${w}` : w; if (measure(t, s.font) > maxWidth && cur) { rows.push(cur); cur = w; } else cur = t; }
        rows.push(cur);
        for (const r of rows) {
            if (y + s.height > pageHeight) { pages.push([]); y = 0; }
            y += s.height; pages[pages.length - 1].push({ text: r, font: s.font, y });
        }
    });
    return pages;
}

export async function renderContractPages(lines: string[]): Promise<Uint8Array[]> {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Plátno není k dispozici.');
    const pages = paginate(lines, (t, f) => { ctx.font = f; return ctx.measureText(t).width; });
    const out: Uint8Array[] = [];
    for (const p of pages) {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#0f172a';
        for (const r of p) { ctx.font = r.font; ctx.fillText(r.text, PAD, PAD + r.y - 10); }
        const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Smlouvu se nepodařilo vykreslit.'))), 'image/png'));
        out.push(new Uint8Array(await blob.arrayBuffer()));
    }
    return out;
}

export async function buildContractPdf(lines: string[], render: (l: string[]) => Promise<Uint8Array[]> = renderContractPages): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    for (const png of await render(lines)) {
        const page = pdf.addPage([595.28, 841.89]);
        page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return pdf.save();
}

import { PDFDocument } from 'pdf-lib';
import { canonicalJson, type Evidence } from './signing';

// Doklad o podpisu jako stránka PDF. Text se kreslí přes plátno prohlížeče, protože základní písma PDF neumí české znaky;
// strojově čitelný doklad (JSON) se navíc přiloží k PDF jako příloha.
const IDENTITY_TEXT = (e: Evidence['identity']) => e.method === 'bankid'
    ? `Ověřena přes Bank iD: ${[e.given, e.family].filter(Boolean).join(' ')}${e.birthdate ? `, nar. ${e.birthdate.split('-').reverse().map(Number).join('. ')}` : ''}${e.verifiedAt ? ` (${new Date(e.verifiedAt).toLocaleString('cs-CZ')})` : ''}${e.phoneMatch === false ? '. Telefon z Bank iD se liší od čísla pro SMS.' : ''}`
    : e.method === 'lawyer' ? `Ověřena advokátem osobně${e.note ? `: ${e.note}` : ''}` : 'Totožnost nebyla ověřována';

export function evidenceLines(e: Evidence, seal: string): string[] {
    return [
        'DOKLAD O ELEKTRONICKÉM PODPISU',
        '',
        `Dokument: ${e.title}`,
        `Otisk dokumentu (SHA-256): ${e.docSha256}`,
        `Podepsal: ${e.signer.name || 'neuvedeno'}`,
        `Totožnost: ${IDENTITY_TEXT(e.identity)}`,
        `Potvrzení: jednorázový kód odeslaný SMS na ${e.signer.phoneMasked}, zadán ${new Date(e.otp.verifiedAt).toLocaleString('cs-CZ')}`,
        `Čas podpisu: ${new Date(e.signedAt).toLocaleString('cs-CZ')}`,
        `IP adresa: ${e.ip}`,
        `Prohlížeč: ${e.userAgent.slice(0, 110)}`,
        '',
        `Prohlášení podepisujícího: ${e.consent}`,
        '',
        `Pečeť dokladu (HMAC-SHA256): ${seal}`,
        `Identifikátor žádosti: ${e.requestId}`,
        '',
        'Jde o elektronický podpis s ověřením totožnosti (nikoli kvalifikovaný podpis). Doklad je zapečetěn serverem; změna kteréhokoli údaje pečeť zneplatní.',
    ];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const out: string[] = [];
    for (const para of text.split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; } else line = test;
            // Dlouhé řetězce bez mezer (otisk, pečeť) se lámou po znacích
            while (ctx.measureText(line).width > maxWidth) { let n = line.length; while (n > 1 && ctx.measureText(line.slice(0, n)).width > maxWidth) n -= 1; out.push(line.slice(0, n)); line = line.slice(n); }
        }
        out.push(line);
    }
    return out;
}

export async function renderEvidencePng(lines: string[]): Promise<Uint8Array> {
    const W = 1240; const H = 1754; const pad = 90;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Plátno není k dispozici.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#0f172a';
    let y = pad + 20;
    lines.forEach((l, i) => {
        ctx.font = i === 0 ? 'bold 40px sans-serif' : '25px sans-serif';
        const rows = wrap(ctx, l, W - pad * 2);
        for (const r of rows) { ctx.fillText(r, pad, y); y += i === 0 ? 56 : 36; }
        if (!l) y += 8;
    });
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Doklad se nepodařilo vykreslit.'))), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
}

const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

// Podepsané PDF: původní PDF s připojenou stránkou dokladu; u jiných formátů vznikne samostatný doklad
export async function buildSignedPdf(original: Uint8Array | null, e: Evidence, seal: string, render: (lines: string[]) => Promise<Uint8Array> = renderEvidencePng): Promise<{ bytes: Uint8Array; withOriginal: boolean }> {
    const withOriginal = !!original && isPdf(original);
    const pdf = withOriginal ? await PDFDocument.load(original as Uint8Array, { ignoreEncryption: false }) : await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const img = await pdf.embedPng(await render(evidenceLines(e, seal)));
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    // pdf-lib bere řetězec jako base64
    await pdf.attach(btoa(unescape(encodeURIComponent(canonicalJson({ evidence: e, seal })))), 'doklad-o-podpisu.json', { mimeType: 'application/json', description: 'Strojově čitelný doklad o podpisu' });
    return { bytes: await pdf.save(), withOriginal };
}

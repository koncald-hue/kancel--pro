import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildSignedPdf, evidenceLines } from './signedPdf';
import type { Evidence } from './signing';

const ev: Evidence = { v: 1, requestId: 'r1', title: 'Smlouva o právních službách', level: 'advanced', docSha256: 'a'.repeat(64), signer: { name: 'Jan Novák', phoneMasked: '+420•••••456' }, identity: { method: 'bankid', given: 'Jan', family: 'Novák', birthdate: '1985-03-02', verifiedAt: '2026-11-16T10:00:00Z' }, otp: { channel: 'sms', verifiedAt: '2026-11-16T10:01:00Z' }, signedAt: '2026-11-16T10:01:05Z', ip: '1.2.3.4', userAgent: 'UA', consent: 'Souhlasím.' };
// 1×1 PNG
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

describe('signed PDF', () => {
    it('lists the evidence including hash, identity, seal and IP', () => {
        const t = evidenceLines(ev, 'f'.repeat(64)).join('\n');
        expect(t).toContain('a'.repeat(64)); expect(t).toContain('f'.repeat(64));
        expect(t).toContain('(Bank iD): Jan Novák, nar. 2. 3. 1985'); expect(t).toContain('1.2.3.4'); expect(t).toContain('+420•••••456');
        expect(evidenceLines({ ...ev, identity: { method: 'lawyer', note: 'OP č. 123' } }, 's').join('\n')).toContain('advokátem osobně: OP č. 123');
    });
    it('appends an evidence page to an existing PDF and attaches the JSON', async () => {
        const src = await PDFDocument.create(); src.addPage(); src.addPage();
        const out = await buildSignedPdf(await src.save(), ev, 'seal', async () => PNG);
        expect(out.withOriginal).toBe(true);
        const back = await PDFDocument.load(out.bytes);
        expect(back.getPageCount()).toBe(3);
    });
    it('creates a standalone evidence PDF for non-PDF documents', async () => {
        const out = await buildSignedPdf(new TextEncoder().encode('PK docx'), ev, 'seal', async () => PNG);
        expect(out.withOriginal).toBe(false);
        expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(1);
    });
});

describe('attachment', () => {
    it('stores the JSON evidence readable in the PDF', async () => {
        const out = await buildSignedPdf(null, ev, 'seal', async () => PNG);
        const doc = await PDFDocument.load(out.bytes);
        const names = doc.context.enumerateIndirectObjects().map(([, o]) => String(o)).join('');
        expect(names).toContain('doklad-o-podpisu.json');
    });
});

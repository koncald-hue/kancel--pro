import { describe, expect, it } from 'vitest';
import { mailAttachment, mailInfo, wordFile, wordInsertText } from './officeBridge';

const read = (b: Blob) => new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(b); });
const ok = (value: unknown) => ({ status: 'succeeded', value });
const fakeWord = (chunks: number[][], url = 'C:\\Spisy\\Žaloba%20Novák.docx') => ({
    FileType: { Compressed: 5 }, CoercionType: { Text: 0 },
    context: { document: {
        url,
        getFileAsync: (_t: number, _o: unknown, cb: (r: unknown) => void) => cb(ok({ sliceCount: chunks.length, getSliceAsync: (i: number, c: (r: unknown) => void) => c(ok({ data: chunks[i] })), closeAsync: (c: () => void) => c() })),
        setSelectedDataAsync: (t: string, _o: unknown, cb: (r: unknown) => void) => { (fakeWord as unknown as { last: string }).last = t; cb(ok(undefined)); },
    } },
});

describe('officeBridge', () => {
    it('Word: složí dokument z částí a vezme název ze cesty', async () => {
        const f = await wordFile(fakeWord([[1, 2], [3]]));
        expect(f.name).toBe('Žaloba Novák.docx');
        expect(new Uint8Array(await read(f.blob))).toEqual(Uint8Array.from([1, 2, 3]));
    });
    it('Word: vloží text na místo kurzoru', async () => { await wordInsertText('Ahoj', fakeWord([[1]])); expect((fakeWord as unknown as { last: string }).last).toBe('Ahoj'); });
    it('Word: chyba z Office se předá jako výjimka', async () => {
        const bad = { FileType: { Compressed: 5 }, context: { document: { getFileAsync: (_a: unknown, _b: unknown, cb: (r: unknown) => void) => cb({ status: 'failed', error: { message: 'nelze' } }) } } };
        await expect(wordFile(bad)).rejects.toThrow('nelze');
    });
    const mail = { CoercionType: { Text: 0 }, context: { mailbox: { item: {
        subject: 'Spis 12 C 5/2026', from: { displayName: 'Jan Novák', emailAddress: 'jan@firma.cz' }, to: [{ emailAddress: 'ja@kancelar.cz' }], dateTimeCreated: '2026-11-18T10:00:00Z',
        body: { getAsync: (_c: number, cb: (r: unknown) => void) => cb(ok('Text zprávy')) },
        attachments: [{ id: 'a1', name: 'smlouva.pdf', size: 3, contentType: 'application/pdf', isInline: false }, { id: 'a2', name: 'logo.png', size: 1, isInline: true }],
        getAttachmentContentAsync: (id: string, cb: (r: unknown) => void) => cb(ok(id === 'a1' ? { format: 'base64', content: btoa('abc') } : { format: 'url', content: 'x' })),
    } } } };
    it('Outlook: načte zprávu a přílohy', async () => {
        const m = await mailInfo(mail);
        expect(m).toMatchObject({ subject: 'Spis 12 C 5/2026', fromEmail: 'jan@firma.cz', to: ['ja@kancelar.cz'], body: 'Text zprávy' });
        expect(m.attachments).toHaveLength(2); expect(m.attachments[1].inline).toBe(true);
    });
    it('Outlook: příloha jako soubor, odkaz se přeskočí', async () => {
        const f = await mailAttachment('a1', 'smlouva.pdf', 'application/pdf', mail);
        expect(f?.name).toBe('smlouva.pdf'); expect(new TextDecoder().decode(await read(f!))).toBe('abc');
        expect(await mailAttachment('a2', 'logo.png', '', mail)).toBeNull();
    });
    it('mimo Office srozumitelná chyba', async () => { await expect(wordFile()).rejects.toThrow(/Office/); });
});

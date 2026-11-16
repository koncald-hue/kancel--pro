// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { STARTER_CATEGORIES, STARTER_TEMPLATES } from './starterTemplates';
import { AUTO_FIELDS, autoValues, fieldsIn, fillTemplate } from './templates';
import { buildRichDocx, plainPreview } from './docx';

const load = async (blob: Blob) => JSZip.loadAsync(await new Promise<ArrayBuffer>((res) => { const f = new FileReader(); f.onload = () => res(f.result as ArrayBuffer); f.readAsArrayBuffer(blob); }));

describe('starter templates', () => {
    it('has unique ids, known categories and a note for the lawyer', () => {
        expect(new Set(STARTER_TEMPLATES.map((t) => t.id)).size).toBe(STARTER_TEMPLATES.length);
        for (const t of STARTER_TEMPLATES) { expect(STARTER_CATEGORIES as readonly string[], t.id).toContain(t.category); expect(t.note.length, t.id).toBeGreaterThan(40); expect(t.description.length, t.id).toBeGreaterThan(20); }
    });
    it('uses only known automatic fields and balanced field braces', () => {
        const known = new Set(AUTO_FIELDS.map((f) => f.key));
        for (const t of STARTER_TEMPLATES) {
            expect((t.body.match(/\{\{/g) ?? []).length, t.id).toBe((t.body.match(/\}\}/g) ?? []).length);
            for (const m of t.body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) { const k = m[1].toLowerCase(); if (k.includes('.')) expect(known.has(k), `${t.id}: ${k}`).toBe(true); }
            expect(fieldsIn(t.body).custom.every((c) => /^[a-z0-9_]+$/.test(c)), t.id).toBe(true);
        }
    });
    it('fills automatic fields from the case, client and lawyer profile', () => {
        const auto = autoValues({ title: 'Spor o dluh', situation: '', client_name: 'Jan Novák', client_email: 'jan@x.cz', client_phone: '777 123 456', reference: '12 C 34/2026', authority: 'Okresní soud Plzeň-město' }, { display_name: 'JUDr. Eva Svobodová', bar_number: '12345', office: 'Dlouhá 1, Plzeň', ico: '27082440', bank_account: '19-2000145399/0800', phone: '+420 603 000 000', contact_email: 'eva@ak.cz', firm_name: 'AK Svobodová' }, new Date('2026-11-16T12:00:00'), { address: 'Krátká 5, Praha', ico: '', dic: '', birth: '1985-03-02' });
        const t = STARTER_TEMPLATES.find((x) => x.id === 'smlouva-pravni-sluzby')!;
        const filled = fillTemplate(t.body, auto, {});
        expect(filled).toContain('JUDr. Eva Svobodová'); expect(filled).toContain('nar. 2. 3. 1985'); expect(filled).toContain('19-2000145399/0800'); expect(filled).toContain('Spor o dluh');
        expect(fieldsIn(filled).auto).toEqual([]);
    });
    it('turns every template into a well-formed Word file with signatures where expected', async () => {
        for (const t of STARTER_TEMPLATES) {
            const zip = await load(await buildRichDocx(t.body, { title: t.title }));
            const xml = await zip.file('word/document.xml')!.async('string');
            expect(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length, t.id).toBe(0);
            expect(xml, t.id).toContain('w:pStyle');
        }
        for (const id of ['smlouva-pravni-sluzby', 'plna-moc-obecna', 'uznani-dluhu-splatky', 'predavaci-protokol']) expect(STARTER_TEMPLATES.find((t) => t.id === id)!.body).toContain('::podpisy');
    });
    it('shows a preview without markup characters', () => {
        for (const t of STARTER_TEMPLATES) { const p = plainPreview(t.body); expect(p, t.id).not.toMatch(/^#{1,2} /m); expect(p, t.id).not.toContain('::podpisy'); expect(p, t.id).not.toContain('**'); }
    });
});

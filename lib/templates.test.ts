import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildDocx, customLabel, fieldsIn, fillTemplate } from './templates';

describe('document templates', () => {
    it('finds automatic and custom fields once each', () => {
        const f = fieldsIn('Pro {{klient.jmeno}}, částka {{castka}} a znovu {{ Castka }} a {{klient.jmeno}} dne {{datum}}');
        expect(f.auto).toEqual(['klient.jmeno', 'datum']);
        expect(f.custom).toEqual(['castka']);
    });

    it('fills known values and leaves unknown fields visible', () => {
        const out = fillTemplate('Vážený {{klient.jmeno}}, dlužíte {{castka}} Kč. {{vec.urad}}', { 'klient.jmeno': 'Jan Novák', 'vec.urad': '' }, { castka: '5000' });
        expect(out).toBe('Vážený Jan Novák, dlužíte 5000 Kč. {{vec.urad}}');
    });

    it('is case-insensitive and ignores braces without a field', () => {
        expect(fillTemplate('{{KLIENT.JMENO}} { x } {{}}', { 'klient.jmeno': 'A' }, {})).toBe('A { x } {{}}');
    });

    it('labels custom fields readably', () => {
        expect(customLabel('cena_za_hodinu')).toBe('Cena za hodinu');
    });

    it('builds a docx with escaped text', async () => {
        const blob = await buildDocx('A & B <x>\nDruhý řádek');
        const zip = await JSZip.loadAsync(await new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(blob); }));
        const xml = await zip.file('word/document.xml')!.async('string');
        expect(xml).toContain('A &amp; B &lt;x&gt;');
        expect(xml.match(/<w:p>/g)).toHaveLength(2);
    });
});

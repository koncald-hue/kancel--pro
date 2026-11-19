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

describe('údaje ze spisu ve vzoru', () => {
    it('doplní protistranu, nejbližší lhůtu a nevyfakturovanou práci', async () => {
        const { extrasValues } = await import('./templates');
        const v = extrasValues({
            contacts: [{ role: 'Soud', name: 'OS Plzeň', email: '', phone: '' }, { role: 'Protistrana', name: 'Alfa s.r.o.', email: 'a@alfa.cz', phone: '777', ico: '27082440' }],
            deadlines: [{ title: 'Odvolání', due_date: '2026-12-20', done: false }, { title: 'Vyjádření', due_date: '2026-12-01', done: false }, { title: 'Hotovo', due_date: '2026-11-01', done: true }],
            entries: [{ minutes: 90, rate: 2000, billed: false }, { minutes: 60, rate: 2000, billed: true }],
        });
        expect(v['protistrana.jmeno']).toBe('Alfa s.r.o.');
        expect(v['vec.nejblizsi_lhuta']).toBe('Vyjádření (do 1. 12. 2026)');
        expect(v['vec.odpracovano_hodin']).toBe('2,5');
        expect(v['vec.nevyfakturovano']).toBe('3 000');
    });
    it('bez údajů nevrací nic', async () => {
        const { extrasValues } = await import('./templates');
        expect(extrasValues(null)).toEqual({});
        expect(extrasValues({ contacts: [{ role: 'Soud', name: 'x', email: '', phone: '' }] })).toEqual({});
    });
});

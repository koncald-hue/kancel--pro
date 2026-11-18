import { describe, expect, it } from 'vitest';
import { BULK_PRESETS, cleanRecipients, render, unknownPlaceholders } from './bulkMail';

describe('hromadný e-mail', () => {
    it('osobní oslovení a věc', () => { expect(render('Dobrý den, {jmeno}, věc {vec}. {kancelar}', { id: '1', name: 'Jan Novák', email: 'a@b.cz', vec: 'Spor' }, 'Kancelář X')).toBe('Dobrý den, Jan Novák, věc Spor. Kancelář X'); });
    it('neznámé pole se nenahradí a hlásí se', () => { expect(render('{xyz}', { id: '1', name: 'A', email: '', vec: '' }, 'K')).toBe('{xyz}'); expect(unknownPlaceholders('Ahoj {jmeno} {xyz} {xyz} { cena }')).toEqual(['xyz', 'cena']); });
    it('příjemci: neplatné a duplicitní adresy se vyřadí', () => {
        const r = cleanRecipients([{ email: 'a@b.cz' }, { email: ' A@B.cz ' }, { email: 'špatně' }, { email: '' }, { email: 'c@d.cz' }]);
        expect(r.ok.length).toBe(2); expect(r.invalid).toBe(2); expect(r.duplicates).toBe(1);
    });
    it('vzory používají jen známá pole', () => { for (const p of BULK_PRESETS) expect(unknownPlaceholders(p.subject + p.body)).toEqual([]); });
});

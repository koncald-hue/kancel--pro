import { describe, expect, it } from 'vitest';
import { accentOf, greetingOf, reminderText } from './portalBrand';

describe('portal branding', () => {
    it('accepts only known accents', () => { expect(accentOf('emerald')).toBe('emerald'); for (const bad of ['red; background:url(x)', '', null, 1, 'EMERALD']) expect(accentOf(bad)).toBe('indigo'); });
    it('cleans the greeting', () => { expect(greetingOf('  Vítejte\u0000\n  u nás ')).toBe('Vítejte \n  u nás'); expect(greetingOf('x'.repeat(500))).toHaveLength(300); expect(greetingOf(5)).toBe(''); });
    it('lists the open requests in the reminder', () => {
        const t = reminderText(['Kopie smlouvy', 'Výpis z účtu'], 'https://x.cz/klient/abc#k', 'pane Vzorový');
        expect(t).toContain('Dobrý den, pane Vzorový'); expect(t).toContain('• Kopie smlouvy\n• Výpis z účtu'); expect(t).toContain('https://x.cz/klient/abc#k');
    });
});

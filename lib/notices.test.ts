import { describe, expect, it } from 'vitest';
import { filterRecipients, isInternalLink, validateNotice } from './notices';

const ok = { title: 'Nová funkce', body: 'Vyzkoušejte nový výkaz.', link: '' };
describe('validateNotice', () => {
    it('platná zpráva', () => expect(validateNotice(ok, 2)).toBeNull());
    it('bez adresáta, s krátkým textem a s cizím odkazem', () => {
        expect(validateNotice(ok, 0)).toMatch(/aspoň jednoho/);
        expect(validateNotice({ ...ok, body: 'ahoj' }, 1)).toMatch(/Zpráva/);
        expect(validateNotice({ ...ok, link: 'https://cizi.cz' }, 1)).toMatch(/Odkaz/);
    });
});
describe('isInternalLink', () => {
    it('jen vnitřní adresy', () => { expect(isInternalLink('/kancelar/veci')).toBe(true); expect(isInternalLink('')).toBe(true); expect(isInternalLink('//cizi.cz')).toBe(false); expect(isInternalLink('/a b')).toBe(false); expect(isInternalLink('javascript:alert(1)')).toBe(false); });
});
describe('filterRecipients', () => {
    const l = [{ user_id: '1', email: 'jan@x.cz', display_name: 'Jan Novák', status: 'trial' }, { user_id: '2', email: 'eva@y.cz', display_name: 'Eva', status: 'active' }];
    it('hledá v e-mailu i jménu', () => { expect(filterRecipients(l, 'nov')).toHaveLength(1); expect(filterRecipients(l, '')).toHaveLength(2); });
});

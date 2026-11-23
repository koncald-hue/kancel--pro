import { describe, expect, it } from 'vitest';
import { cityOf, decisionMail, toDirectoryLawyer, validatePartnerInquiry } from './directory';

const base = { lawyer: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', name: 'Jana Nová', email: 'jana@example.cz', message: 'Pronajímatel mi nevrací kauci už půl roku.', consent: true };

describe('validatePartnerInquiry', () => {
    it('přijme platnou poptávku a ignoruje neznámý obor a kraj', () => {
        const r = validatePartnerInquiry({ ...base, area: 'bydleni', region: 'Plzeňský kraj', district: 'Plzeň-město', ref: 'abcdefghijklmnop1234' });
        expect(r.ok && r.value.area).toBe('bydleni');
        const bad = validatePartnerInquiry({ ...base, area: 'hack', region: 'Bavorsko' });
        expect(bad.ok && bad.value.area).toBe(null);
        expect(bad.ok && bad.value.region).toBe(null);
    });
    it('bez souhlasu, kontaktu nebo popisu neprojde', () => {
        expect(validatePartnerInquiry({ ...base, consent: false })).toEqual({ ok: false, field: 'consent' });
        expect(validatePartnerInquiry({ ...base, email: '', phone: '' })).toEqual({ ok: false, field: 'email' });
        expect(validatePartnerInquiry({ ...base, email: '', phone: '+420 777 123 456' }).ok).toBe(true);
        expect(validatePartnerInquiry({ ...base, message: 'krátké' })).toEqual({ ok: false, field: 'message' });
        expect(validatePartnerInquiry({ ...base, lawyer: 'x' })).toEqual({ ok: false, field: 'lawyer' });
    });
});

describe('katalog', () => {
    it('z adresy vezme město bez PSČ', () => {
        expect(cityOf('Náměstí Republiky 1, 301 00 Plzeň')).toBe('Plzeň');
        expect(cityOf('Brno')).toBe('Brno');
    });
    it('evidenční číslo ukáže jen u advokáta a nepustí cizí obrázek', () => {
        const l = toDirectoryLawyer({ directory_id: 'id', display_name: 'JUDr. Jan Novák', register_name: null, bar_number: '12345', office: 'Praha', profession: 'jiny', directory_areas: ['rodina', 'x'], directory_regions: ['Hlavní město Praha'], directory_consult: '', directory_bio: '', avatar_small: 'javascript:alert(1)', website: '' });
        expect(l.bar).toBe('');
        expect(l.areas).toEqual(['rodina']);
        expect(l.photo).toBe(null);
    });
    it('e-mail při odmítnutí nabídne další advokáty', () => {
        const m = decisionMail('declined', { clientName: 'Jana', lawyerName: 'JUDr. Novák', lawyerEmail: '', lawyerPhone: '', catalogUrl: 'https://studujpravo.cz/advokati' });
        expect(m.text).toContain('https://studujpravo.cz/advokati');
        expect(decisionMail('accepted', { clientName: 'Jana', lawyerName: 'X', lawyerEmail: 'x@y.cz', lawyerPhone: '', catalogUrl: '' }).text).toContain('Kontakt: x@y.cz');
    });
});

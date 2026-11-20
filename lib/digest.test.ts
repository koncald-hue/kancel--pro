import { describe, expect, it } from 'vitest';
import { buildClientDigest, buildDigest, hasAnything, type DigestInput } from './digest';

const base: DigestInput = { name: 'Jana', today: '2026-11-23', details: false, appUrl: 'https://k.cz', overdue: [], upcoming: [], caseEvents: [], unbilledMinutes: 0, unbilledAmount: 0, overdueInvoices: 0, newInquiries: 0, substituting: [], archiveExpired: 0, deliveriesPending: 0 };
const dl = (t: string, d: string) => ({ title: t, due_date: d, case_title: 'Novák v. Dvořák', kind: 'lhuta' as const });

describe('digest', () => {
    it('bez detailů neobsahuje názvy věcí ani lhůt', () => {
        const r = buildDigest({ ...base, overdue: [dl('Odvolání', '2026-11-20')], upcoming: [dl('Vyjádření', '2026-11-25')], caseEvents: [{ case_title: 'Novák v. Dvořák', count: 3 }] });
        expect(r.subject).toBe('Kancelář Pro: 1 lhůta nebo úkol po termínu');
        expect(r.text).not.toContain('Novák'); expect(r.text).not.toContain('Odvolání');
        expect(r.text).toContain('PO TERMÍNU: 1'); expect(r.text).toContain('Termíny na příštích 7 dní: 1'); expect(r.text).toContain('https://k.cz/kancelar');
    });
    it('s detaily vypíše termíny a věci', () => {
        const r = buildDigest({ ...base, details: true, upcoming: [dl('Vyjádření', '2026-11-25')], caseEvents: [{ case_title: 'Novák v. Dvořák', count: 3 }], unbilledMinutes: 95, unbilledAmount: 3958.3 });
        expect(r.subject).toBe('Kancelář Pro: 1 termín na příštích 7 dní');
        expect(r.text).toContain('25. 11. lhůta: Vyjádření (Novák v. Dvořák)'); expect(r.text).toContain('Novák v. Dvořák: 3'); expect(r.text).toMatch(/1:35 h \(3\s958 Kč\)/);
    });
    it('zastupování, pošta a archiv', () => {
        const r = buildDigest({ ...base, substituting: [{ name: 'Petr', to_on: '2026-11-30', deadlines: 2 }], deliveriesPending: 1, archiveExpired: 4 });
        expect(r.text).toContain('Petr do 30. 11.: 2 termíny'); expect(r.text).toContain('bez potvrzeného doručení: 1'); expect(r.text).toContain('lhůtou uložení: 4');
    });
    it('prázdný týden se nepošle', () => { expect(hasAnything(base)).toBe(false); expect(hasAnything({ ...base, newInquiries: 1 })).toBe(true); });
    it('klient dostane jen počty bez obsahu', () => {
        expect(buildClientDigest({ who: 'Mgr. X', news: 0, tasks: 0 })).toBeNull();
        const r = buildClientDigest({ who: 'Mgr. X', news: 2, tasks: 1 })!;
        expect(r.text).toContain('2 nové informace a 1 úkol pro Vás'); expect(r.text).not.toMatch(/https?:/);
    });
});

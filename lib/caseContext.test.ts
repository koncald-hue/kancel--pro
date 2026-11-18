import { describe, expect, it } from 'vitest';
import { buildContext, caseHeader, chronologyText, deadlinesText, docsText } from './caseContext';

const item = { title: 'Novák proti Dvořákovi', reference: '12 C 5/2026', authority: 'Okresní soud Plzeň-město', client_name: 'Jan Novák', status: 'open' as const, summary: '', note: '' };

describe('caseContext', () => {
    it('hlavička vynechá prázdné údaje', () => {
        expect(caseHeader({ ...item, reference: '', authority: '' })).toBe('Věc: Novák proti Dvořákovi\nKlient: Jan Novák\nStav: otevřená');
    });
    it('lhůty: jen otevřené, seřazené a s označením prošlých', () => {
        const t = deadlinesText([{ title: 'B', due_date: '2026-12-01', done: false, kind: 'lhuta' }, { title: 'A', due_date: '2026-11-10', done: false, kind: 'ukol' }, { title: 'X', due_date: '2026-11-01', done: true }], '2026-11-18');
        expect(t.split('\n')).toEqual(['Otevřené lhůty a úkoly:', '- 10. 11. 2026 (PO TERMÍNU): úkol – A', '- 1. 12. 2026: lhůta – B']);
        expect(deadlinesText([], '2026-11-18')).toBe('');
    });
    it('chronologie chronologicky a zkrácená na posledních N', () => {
        const e = Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, body: '', happened_on: `2026-01-0${i + 1}`, created_at: '' }));
        expect(chronologyText(e, 2)).toBe('Chronologie:\n- 4. 1. 2026: T3\n- 5. 1. 2026: T4');
    });
    it('dokumenty se rozdělí do místa a označí zkrácení', () => {
        const t = docsText([{ name: 'a.pdf', body: 'x'.repeat(5000) }, { name: 'b.pdf', body: 'krátký' }], 2000);
        expect(t).toContain('=== Dokument: a.pdf ==='); expect(t).toContain('[… zkráceno]'); expect(t).toContain('krátký');
        expect(t.length).toBeLessThan(2100);
        expect(docsText([{ name: 'a', body: 'x' }], 100)).toBe('');
    });
    it('podklad pro koncept obsahuje druh, pokyny a nepřesáhne limit', () => {
        const t = buildContext({ task: 'draft', draftType: 'vyzva', instructions: 'dluh 25 000 Kč za dílo', item, deadlines: [], entries: [], docs: [{ name: 'smlouva.pdf', body: 'y'.repeat(20000) }], today: '2026-11-18', max: 3000 });
        expect(t.startsWith('ÚKOL: Předžalobní výzva k plnění\nPokyny advokáta: dluh 25 000 Kč za dílo')).toBe(true);
        expect(t).toContain('Spisová značka: 12 C 5/2026'); expect(t.length).toBeLessThanOrEqual(3000);
    });
    it('otázka nad spisem', () => {
        expect(buildContext({ task: 'ask', question: 'Kdy byla doručena žaloba?', item, deadlines: [], entries: [], docs: [], today: '2026-11-18', max: 5000 })).toMatch(/^OTÁZKA: Kdy byla doručena žaloba\?/);
    });
});

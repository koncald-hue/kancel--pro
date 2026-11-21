import { describe, expect, it } from 'vitest';
import { analyzeText } from './lhutyExtract';

const one = (t: string) => analyzeText(t, 'a.pdf').candidates;

describe('finding deadlines in decisions', () => {
    it('finds an appeal period in the instruction of a judgment', () => {
        const [c] = one('ROZSUDEK Jménem republiky ... Poučení: Proti tomuto rozsudku lze podat odvolání do 15 dnů ode dne doručení jeho písemného vyhotovení ke Krajskému soudu v Plzni.');
        expect(c).toMatchObject({ label: 'Odvolání', n: 15, unit: 'den', trigger: 'doruceni', confidence: 'vysoka', kind: 'relativni' });
        expect(c.quote).toContain('odvolání do 15 dnů');
    });
    it('understands numbers written in words and the objection to a payment order', () => {
        const [c] = one('Proti tomuto platebnímu rozkazu může žalovaný podat odpor do patnácti dnů od doručení.');
        expect(c).toMatchObject({ label: 'Odpor proti platebnímu rozkazu', n: 15, trigger: 'doruceni' });
    });
    it('finds months and a request to complete the submission', () => {
        expect(one('Dovolání lze podat do dvou měsíců od doručení rozhodnutí odvolacího soudu.')[0]).toMatchObject({ label: 'Dovolání', n: 2, unit: 'mesic' });
        expect(one('Soud vyzývá žalobce, aby ve lhůtě 7 dnů od doručení této výzvy doplnil žalobu o tvrzení.')[0]).toMatchObject({ label: 'Doplnění nebo odstranění vad podání', n: 7 });
    });
    it('flags deadlines that do not start with delivery', () => {
        const [c] = one('Žalovanému se ukládá zaplatit žalobci částku do 3 dnů od právní moci tohoto rozsudku.');
        expect(c.trigger).toBe('pravni_moc');
        expect(c.warnings.join(' ')).toContain('právní moci');
        expect(c.confidence).not.toBe('vysoka');
    });
    it('does not guess when the start is not stated or the period is in working days', () => {
        const [a] = one('Navrhovatel se vyzývá, aby se vyjádřil ve lhůtě 10 dnů.');
        expect(a.trigger).toBe('neuveden');
        expect(a.warnings.join(' ')).toContain('není uvedeno');
        const [b] = one('Svědek se dostaví do 3 pracovních dnů od doručení.');
        expect(b.trigger).toBe('neuveden');
        expect(b.warnings.join(' ')).toContain('pracovních dnech');
        expect(b.confidence).toBe('nizka');
    });
    it('finds absolute dates, also with month names, and warns about ranges', () => {
        const a = one('Žalovaný se vyzývá, aby se vyjádřil nejpozději do 15. 12. 2026.');
        expect(a[0]).toMatchObject({ kind: 'absolutni', date: '2026-12-15', label: 'Vyjádření' });
        expect(one('Návrh je třeba podat do 3. března 2027.')[0].date).toBe('2027-03-03');
        const r = one('Plnění se poskytne za období od 1. 1. 2026 do 31. 1. 2026 včetně.');
        expect(r[0].confidence).toBe('nizka');
        expect(r[0].warnings.join(' ')).toContain('konec období');
    });
    it('ignores dates and numbers that are not deadlines and rejects invalid dates', () => {
        expect(one('Dne 9. 11. 2026 bylo rozhodnuto ve spisu vedené pod sp. zn. 12 C 34/2026 o částce 15 000 Kč.')).toEqual([]);
        expect(one('Splatnost je do 31. 2. 2026.')).toEqual([]);
    });
    it('does not duplicate the same deadline and reports when nothing is found', () => {
        expect(one('Odvolání lze podat do 15 dnů od doručení. Odvolání lze podat do 15 dnů od doručení.')).toHaveLength(1);
        const a = analyzeText('Toto je jen oznámení o termínu jednání.', 'b.pdf');
        expect(a.candidates).toEqual([]);
        expect(a.notes.join(' ')).toContain('neznamená, že žádná neběží');
    });
    it('collects the instruction text and notes about inadmissible remedies', () => {
        const a = analyzeText('USNESENÍ Soud rozhodl takto ... Poučení: Proti tomuto usnesení není odvolání přípustné.', 'c.pdf');
        expect(a.docType).toBe('Usnesení');
        expect(a.poucení[0]).toContain('není odvolání přípustné');
        expect(a.notes.join(' ')).toContain('není přípustný');
    });
});

describe('false positives and tricky wording', () => {
    it('ignores hearing dates and decision dates without a deadline cue', () => {
        expect(one('Jednání se nařizuje na den 15. 12. 2026 v 9:00 hodin v jednací síni č. 5.')).toEqual([]);
        expect(one('Rozsudek nabyl právní moci dne 3. 3. 2026.')).toEqual([]);
    });
    it('reads a deadline written as a noun phrase and flags the missing start', () => {
        const [c] = one('Lhůta k podání odvolání je 15 dnů.');
        expect(c).toMatchObject({ label: 'Odvolání', n: 15, trigger: 'neuveden' });
        expect(c.warnings.join(' ')).toContain('není uvedeno');
    });
    it('keeps several different deadlines from one decision apart', () => {
        const a = one('Proti výroku I. lze podat odvolání do 15 dnů od doručení. Proti výroku o nákladech lze podat odvolání do 8 dnů od doručení a odpor do 15 dnů od doručení.');
        expect(a.map((c) => `${c.label}:${c.n}`)).toEqual(['Odvolání:15', 'Odvolání:8', 'Odpor proti platebnímu rozkazu:15']);
    });
    it('does not treat amounts, case numbers or ages as deadlines', () => {
        expect(one('Žalovaný zaplatí 15 000 Kč. Spis vedený pod sp. zn. 12 C 15/2026. Žalobce je mu 15 let.')).toEqual([]);
    });
});

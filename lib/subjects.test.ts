import { describe, expect, it } from 'vitest';
import { buildSubjects } from './subjects';

const cases = [{ id: 'c1', title: 'Spis 1' }, { id: 'c2', title: 'Spis 2' }];
describe('buildSubjects', () => {
    it('sloučí stejnou osobu z různých spisů podle e-mailu a jména', () => {
        const s = buildSubjects([
            { id: 'a', case_id: 'c1', role: 'Protistrana', name: 'Jan Zoufalý', email: 'jan@x.cz', phone: '' },
            { id: 'b', case_id: 'c2', role: 'Svědek', name: 'Zoufalý Jan', email: 'JAN@x.cz', phone: '' },
        ], [], cases);
        expect(s).toHaveLength(1);
        expect(s[0].appearances.map((a) => a.role).sort()).toEqual(['Protistrana', 'Svědek']);
    });
    it('spojí klienta s kontaktem podle IČO a nespojí různé lidi', () => {
        const s = buildSubjects(
            [{ id: 'a', case_id: 'c1', role: 'Klient', name: 'AVE Soft', email: '', phone: '', ico: '25378392' }, { id: 'b', case_id: 'c2', role: 'Jiný', name: 'Petr Novák', email: '', phone: '' }],
            [{ id: 'k1', name: 'AVE Soft s.r.o.', email: '', phone: '', ico: '25378392' }], cases);
        expect(s).toHaveLength(2);
        expect(s.find((x) => x.icos.includes('25378392'))?.clientIds).toEqual(['k1']);
        expect(s.find((x) => x.icos.includes('25378392'))?.name).toBe('AVE Soft s.r.o.');
    });
    it('telefon porovná bez předvolby', () => {
        const s = buildSubjects([{ id: 'a', case_id: 'c1', role: '', name: 'A', email: '', phone: '+420 777 123 456' }, { id: 'b', case_id: 'c2', role: '', name: 'B', email: '', phone: '777123456' }], [], cases);
        expect(s).toHaveLength(1);
    });
});

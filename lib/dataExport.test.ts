import { describe, expect, it } from 'vitest';
import { buildDataExport } from './dataExport';

describe('export všech dat', () => {
    const out = buildDataExport({
        clients: [{ name: 'Jan Novák', email: 'j@x.cz', birth: '1985-03-02', hourly_rate: 2500 }],
        cases: [{ id: 'c1', title: 'Spor; o "dluh"', client_name: 'Jan Novák', status: 'done', created_at: '2026-01-05T10:00:00Z' }],
        deadlines: [{ case_id: 'c1', title: 'Odvolání', due_date: '2026-12-01', done: false }],
        contacts: [{ case_id: 'c1', role: 'Protistrana', name: 'Alfa s.r.o.' }],
        entries: [{ case_id: 'c1', title: 'Jednání', body: 'ok', happened_on: '2026-02-01', kind: 'event' }, { case_id: 'c1', title: 'tajné', body: 'zašifrováno', enc: true }],
        time: [{ case_id: 'c1', entry_date: '2026-02-01', minutes: 90, description: 'porada', rate: 2000, billed: true }],
    });
    const file = (n: string) => out.files.find((f) => f.name === n)!.content;
    it('vytvoří tabulky s českými hlavičkami a uvozuje středníky a uvozovky', () => {
        expect(file('veci.csv')).toContain('"Spor; o ""dluh"""');
        expect(file('veci.csv')).toContain('uzavřená');
        expect(file('klienti.csv')).toContain('2. 3. 1985');
    });
    it('propojí lhůty a čas s názvem spisu a nevynáší šifrované zápisy', () => {
        expect(file('lhuty.csv')).toContain('"Spor; o ""dluh""";Odvolání;1. 12. 2026;ne');
        expect(file('zapisy-ve-vecech.csv')).not.toContain('tajné');
        expect(out.counts.zapisy).toBe(1);
        expect(file('vykazy-casu.csv')).toContain('90');
    });
});

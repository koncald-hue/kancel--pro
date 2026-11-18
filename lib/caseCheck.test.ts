import { describe, expect, it } from 'vitest';
import { caseCheck } from './caseCheck';

const base = { item: { client_name: 'Jan Novák', reference: '12 C 5/2026', authority: 'OS Plzeň' }, files: [{ name: 'Plná moc - Novák.pdf' }], deadlines: [], contacts: [{ role: 'Protistrana', name: 'Petr Dvořák' }], today: '2026-11-18' };

describe('caseCheck', () => {
    it('úplná věc nemá varování', () => { expect(caseCheck(base).every((c) => c.level === 'ok')).toBe(true); });
    it('chybějící klient a prošlá lhůta jsou chyby a jsou nahoře', () => {
        const r = caseCheck({ ...base, item: { ...base.item, client_name: '' }, deadlines: [{ title: 'Odvolání', due_date: '2026-11-10', done: false }] });
        expect(r[0].level).toBe('error'); expect(r.filter((c) => c.level === 'error').map((c) => c.id).sort()).toEqual(['klient', 'po']);
    });
    it('plná moc se pozná i bez diakritiky a s podtržítky', () => {
        expect(caseCheck({ ...base, files: [{ name: 'plna_moc_scan.pdf' }] }).find((c) => c.id === 'pm')?.level).toBe('ok');
        expect(caseCheck({ ...base, files: [{ name: 'PLNÁ MOC.pdf' }] }).find((c) => c.id === 'pm')?.level).toBe('ok');
        expect(caseCheck({ ...base, files: [{ name: 'smlouva.pdf' }] }).find((c) => c.id === 'pm')?.level).toBe('warn');
    });
    it('blízká lhůta je varování, splněná se nepočítá', () => {
        const r = caseCheck({ ...base, deadlines: [{ title: 'Vyjádření', due_date: '2026-11-20', done: false }, { title: 'Staré', due_date: '2026-11-01', done: true }] });
        expect(r.find((c) => c.id === 'brzy')?.level).toBe('warn'); expect(r.find((c) => c.id === 'po')).toBeUndefined();
    });
    it('mimosoudní věc bez soudu nehlásí chybějící spisovou značku', () => {
        expect(caseCheck({ ...base, item: { client_name: 'X' } }).find((c) => c.id === 'sz' || c.id === 'soud')).toBeUndefined();
    });
    it('chybějící protistrana; role bez diakritiky', () => {
        expect(caseCheck({ ...base, contacts: [] }).find((c) => c.id === 'ps')?.level).toBe('warn');
        expect(caseCheck({ ...base, contacts: [{ role: 'zalovany', name: 'A' }] }).find((c) => c.id === 'ps')?.level).toBe('ok');
    });
});

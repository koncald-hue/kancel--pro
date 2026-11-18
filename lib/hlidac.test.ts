import { describe, expect, it } from 'vitest';
import { rizeniChange, rizeniQuery } from './hlidac';
import { daySummary } from './workConfirm';
import { estimate, suggest, type Activity } from './workLog';
import type { RizeniView } from './katastr';

const r = (over: Partial<RizeniView> = {}): RizeniView => ({ id: 7, typ: 'V', typNazev: 'Vklad', cislo: '1234/2026', kodPracoviste: 101, datumPrijeti: '2026-02-01', stav: 'Probíhá', stavUhrady: 'Uhrazeno', navazana: [], poznamky: [], ...over });

describe('rizeniChange', () => {
    it('returns null when nothing changed, even if list order differs', () => {
        expect(rizeniChange(r({ navazana: ['Záznam 1/2026', 'Vklad 2/2026'] }), r({ navazana: ['Vklad 2/2026', 'Záznam 1/2026'] }))).toBeNull();
    });
    it('describes state, fee and follow-up changes with a stable reference', () => {
        const c = rizeniChange(r(), r({ stav: 'Zapsáno', stavUhrady: 'Neuhrazeno', navazana: ['Záznam 9/2026'] }))!;
        expect(c.title).toBe('Katastr: změna řízení Vklad 1234/2026');
        expect(c.detail).toContain('stav: „Probíhá“ → „Zapsáno“'); expect(c.detail).toContain('úhrada poplatku: Uhrazeno → Neuhrazeno'); expect(c.detail).toContain('nové navazující řízení: Záznam 9/2026');
        expect(rizeniChange(r(), r({ stav: 'Zapsáno', stavUhrady: 'Neuhrazeno', navazana: ['Záznam 9/2026'] }))!.ref).toBe(c.ref);
        expect(rizeniChange(r(), r({ stav: 'Jiný' }))!.ref).not.toBe(c.ref);
    });
});
describe('rizeniQuery', () => {
    it('parses number/year and workplace', () => { expect(rizeniQuery(r())).toEqual({ typ: 'V', cislo: 1234, rok: 2026, ws: 101 }); });
    it('rejects incomplete data', () => { expect(rizeniQuery(r({ cislo: '?/2026' }))).toBeNull(); expect(rizeniQuery(r({ kodPracoviste: 0 }))).toBeNull(); });
});

const act = (id: string, caseId: string, kind: Activity['kind'], at: string): Activity => ({ id, case_id: caseId, kind, label: '', words: 0, at, time_entry_id: null, dismissed: false });
describe('day summary and new activity kind', () => {
    it('estimates a finished task', () => { expect(estimate({ kind: 'deadline_done', words: 0 })).toBe(5); });
    it('splits today from older suggestions and totals today', () => {
        const list = suggest([act('1', 'a', 'datovka_read', '2030-03-10T08:00:00Z'), act('2', 'b', 'deadline_done', '2030-03-10T09:00:00Z'), act('3', 'a', 'email_sent', '2030-03-08T09:00:00Z')], [], { unit: 15 });
        const s = daySummary(list, '2030-03-10');
        expect(s.today).toHaveLength(2); expect(s.older).toHaveLength(1); expect(s.minutes).toBe(30); expect(s.cases).toBe(2);
    });
});

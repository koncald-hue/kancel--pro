import { describe, expect, it } from 'vitest';
import { aresChanges, dueForCheck, isLiquidation, suggestDeadline } from './radar';
import { normalizeCompany } from './ares';

const base = { name: 'Alfa s.r.o.', address: 'Dlouhá 1, 301 00 Plzeň', ended: null };

describe('radar', () => {
    it('records the first state quietly but reports liquidation or dissolution right away', () => {
        expect(aresChanges(null, base)).toEqual([]);
        expect(aresChanges(null, { ...base, name: 'Alfa s.r.o. v likvidaci' }).map((e) => e.kind)).toEqual(['likvidace']);
        expect(aresChanges(null, { ...base, ended: '2026-10-31' })[0]).toMatchObject({ kind: 'zanik', ref: 'zanik:2026-10-31', event_date: '2026-10-31' });
    });
    it('detects liquidation without also reporting a name change', () => {
        const e = aresChanges(base, { ...base, name: 'Alfa s.r.o., v likvidaci' });
        expect(e.map((x) => x.kind)).toEqual(['likvidace']);
        expect(aresChanges({ ...base, name: 'Alfa s.r.o. v likvidaci' }, { ...base, name: 'Alfa s.r.o. v likvidaci' })).toEqual([]);
    });
    it('reports name and seat changes but ignores case, spaces and punctuation', () => {
        expect(aresChanges(base, { ...base, name: 'ALFA  s.r.o' })).toEqual([]);
        expect(aresChanges(base, { ...base, name: 'Beta s.r.o.' }).map((e) => e.kind)).toEqual(['zmena_nazvu']);
        const s = aresChanges(base, { ...base, address: 'Krátká 5, 110 00 Praha 1' });
        expect(s[0]).toMatchObject({ kind: 'zmena_sidla' }); expect(s[0].detail).toContain('Dříve: Dlouhá 1');
    });
    it('recognises liquidation in the name', () => { expect(isLiquidation('Gama a.s. v likvidaci')).toBe(true); expect(isLiquidation('Likvidace odpadů s.r.o.')).toBe(false); });
    it('suggests the insolvency claim deadline two months from the decision, moved to a working day', () => {
        const d = suggestDeadline('insolvence', '2026-10-17')!;
        expect(d.title).toBe('Přihláška pohledávky do insolvenčního řízení');
        expect(d.raw).toBe('2026-12-17'); expect(d.end).toBe('2026-12-17');
        // 2 měsíce od 24. 10. 2026 = 24. 12. 2026 (svátek) → posun na 28. 12. 2026
        expect(suggestDeadline('insolvence', '2026-10-24')!.end).toBe('2026-12-28');
        expect(suggestDeadline('insolvence', null)).toBeNull();
        expect(suggestDeadline('zmena_sidla', '2026-10-17')).toBeNull();
    });
    it('checks ARES at most every 12 hours', () => {
        const now = Date.parse('2026-11-17T12:00:00Z');
        expect(dueForCheck(null, now)).toBe(true);
        expect(dueForCheck('2026-11-17T06:00:00Z', now)).toBe(false);
        expect(dueForCheck('2026-11-16T23:00:00Z', now)).toBe(true);
    });
    it('reads the dissolution date from ARES', () => {
        expect(normalizeCompany({ ico: '27082440', obchodniJmeno: 'Alfa', sidlo: { textovaAdresa: 'X' }, datumZaniku: '2026-10-31' })?.ended).toBe('2026-10-31');
        expect(normalizeCompany({ ico: '27082440', obchodniJmeno: 'Alfa' })?.ended).toBeNull();
    });
});

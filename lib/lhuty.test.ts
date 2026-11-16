import { describe, expect, it } from 'vitest';
import { explain, parseDateInput, addDays, computeAbsolute, computeEnd, czDate, daysBetween, deliveryOf, isIsoDate, nonWorkingReason, pragueDate, rawEnd, unitText, weekdayOf } from './lhuty';

describe('date arithmetic', () => {
    it('adds days across month and year ends and validates ISO dates', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
        expect(daysBetween('2026-11-09', '2026-11-24')).toBe(15);
        expect(isIsoDate('2026-02-29')).toBe(false);
        expect(isIsoDate('2028-02-29')).toBe(true);
        expect(weekdayOf('2026-11-16')).toBe('pondělí');
        expect(czDate('2026-03-05')).toBe('5. 3. 2026');
    });
    it('formats periods with correct Czech plurals', () => {
        expect([1, 2, 5, 15].map((n) => unitText(n, 'den'))).toEqual(['1 den', '2 dny', '5 dnů', '15 dnů']);
        expect([1, 2, 6].map((n) => unitText(n, 'mesic'))).toEqual(['1 měsíc', '2 měsíce', '6 měsíců']);
        expect([1, 3, 10].map((n) => unitText(n, 'rok'))).toEqual(['1 rok', '3 roky', '10 let']);
    });
});

describe('days off (zákon č. 245/2000 Sb.)', () => {
    it('recognises weekends, fixed holidays, Good Friday and Easter Monday', () => {
        expect(nonWorkingReason('2026-11-14')).toBe('sobota');
        expect(nonWorkingReason('2026-11-15')).toBe('neděle');
        expect(nonWorkingReason('2026-11-17')).toContain('svátek');
        expect(nonWorkingReason('2026-12-24')).toContain('Štědrý den');
        expect(nonWorkingReason('2027-03-26')).toContain('Velký pátek');
        expect(nonWorkingReason('2027-03-29')).toContain('Velikonoční pondělí');
        expect(nonWorkingReason('2026-11-18')).toBe('');
        expect(nonWorkingReason('2026-05-01')).toContain('Svátek práce');
    });
});

describe('end of a period (§ 57 o. s. ř.)', () => {
    it('does not count the day of the event and counts plain days', () => {
        expect(rawEnd('2026-11-09', 15, 'den')).toBe('2026-11-24');
        const e = computeEnd('2026-11-09', 15, 'den');
        expect(e).toMatchObject({ end: '2026-11-24', shiftedFrom: null, weekday: 'úterý', internal: '2026-11-23' });
    });
    it('moves an end on a holiday to the next working day', () => {
        const e = computeEnd('2026-11-02', 15, 'den');
        expect(e.raw).toBe('2026-11-17');
        expect(e.end).toBe('2026-11-18');
        expect(e.reasons[0]).toContain('svátek');
    });
    it('handles weeks, months and years incl. missing days', () => {
        expect(rawEnd('2026-11-09', 2, 'tyden')).toBe('2026-11-23');
        expect(rawEnd('2026-01-31', 1, 'mesic')).toBe('2026-02-28');
        expect(rawEnd('2026-01-31', 2, 'mesic')).toBe('2026-03-31');
        expect(rawEnd('2026-12-31', 2, 'mesic')).toBe('2027-02-28');
        expect(rawEnd('2024-02-29', 1, 'rok')).toBe('2025-02-28');
        expect(rawEnd('2026-11-30', 3, 'mesic')).toBe('2027-02-28');
        expect(rawEnd('2026-10-31', 12, 'mesic')).toBe('2027-10-31');
    });
    it('shifts month ends that fall on a weekend', () => {
        const e = computeEnd('2026-01-31', 1, 'mesic');
        expect(e.raw).toBe('2026-02-28');
        expect(e.end).toBe('2026-03-02');
        expect(computeEnd('2026-12-31', 2, 'mesic').end).toBe('2027-03-01');
    });
    it('skips a whole block of days off around Easter and Christmas', () => {
        expect(computeEnd('2027-03-11', 15, 'den').end).toBe('2027-03-30');
        const c = computeEnd('2026-12-09', 15, 'den');
        expect(c.raw).toBe('2026-12-24');
        expect(c.end).toBe('2026-12-28');
        expect(c.reasons).toHaveLength(4);
    });
    it('suggests an internal date on the last working day before the end', () => {
        expect(computeEnd('2026-11-02', 15, 'den').internal).toBe('2026-11-16');
        expect(computeEnd('2026-12-09', 15, 'den').internal).toBe('2026-12-23');
    });
    it('also shifts absolute dates set by the decision', () => {
        expect(computeAbsolute('2026-11-14').end).toBe('2026-11-16');
        expect(computeAbsolute('2026-11-18').shiftedFrom).toBeNull();
    });
});

describe('delivery date of a data message (§ 17 zákona č. 300/2008 Sb.)', () => {
    const today = '2026-11-16';
    it('uses the login time when the message was read', () => {
        const d = deliveryOf({ status: '7', delivered: '2026-11-09T13:20:00', accepted: '2026-11-09T14:22:00', today });
        expect(d).toMatchObject({ date: '2026-11-09', basis: 'prihlaseni', certain: true });
    });
    it('treats status 5 as fiction and keeps the accepted date', () => {
        const d = deliveryOf({ status: '5', delivered: '2026-11-01T10:00:00', accepted: '2026-11-11T00:00:00', today });
        expect(d).toMatchObject({ date: '2026-11-11', basis: 'fikce' });
    });
    it('delivers an undelivered message today when it was just downloaded', () => {
        const d = deliveryOf({ status: '4', delivered: '2026-11-10T10:00:00', accepted: '', downloadedNow: true, today });
        expect(d).toMatchObject({ date: today, basis: 'stazeni', certain: true });
    });
    it('for an undelivered message shows the latest possible fiction date as uncertain', () => {
        const d = deliveryOf({ status: '4', delivered: '2026-11-10T10:00:00', accepted: '', today });
        expect(d).toMatchObject({ date: '2026-11-20', basis: 'ocekavano', certain: false });
        expect(d.warnings.join(' ')).toContain('lhůta zatím neběží');
    });
    it('converts timestamps with a zone to Prague dates', () => {
        expect(pragueDate('2026-11-09T23:30:00Z')).toBe('2026-11-10');
        expect(pragueDate('2026-11-09T10:00:00+01:00')).toBe('2026-11-09');
        expect(pragueDate('2025-12-30Z')).toBe('2025-12-30');
        expect(pragueDate('2026-11-09T10:00:00')).toBe('2026-11-09');
    });
    it('returns an empty date when nothing is known', () => {
        expect(deliveryOf({ status: '4', delivered: '', accepted: '', today }).date).toBe('');
    });
});

describe('manual date input and explanation', () => {
    it('accepts Czech and ISO dates with a four-digit year only', () => {
        expect(parseDateInput('9. 11. 2026')).toBe('2026-11-09');
        expect(parseDateInput('09.11.2026')).toBe('2026-11-09');
        expect(parseDateInput('2026-11-09')).toBe('2026-11-09');
        expect(['9. 11. 26', '31. 2. 2026', '1. 1. 1999', ''].map(parseDateInput)).toEqual([null, null, null, null]);
    });
    it('explains how the end was computed, including a shift', () => {
        const e = computeEnd('2026-11-02', 15, 'den');
        const t = explain(e, 15, 'den', 'Doručeno 2. 11. 2026.');
        expect(t).toContain('končí 17. 11. 2026');
        expect(t).toContain('nejbližší následující pracovní den 18. 11. 2026');
        expect(t).toContain('Doporučeno podat nejpozději 16. 11. 2026');
        expect(explain(computeEnd('2026-11-09', 15, 'den'), 15, 'den', 'x')).not.toContain('nepracovní');
    });
});

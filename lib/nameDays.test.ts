import { describe, expect, it } from 'vitest';
import { NAME_DAYS, holidayName, isoWeek, nameDay } from './nameDays';

describe('name days and holidays', () => {
    it('has the right number of days in every month (Feb with 29)', () => {
        expect(NAME_DAYS.map((m) => m.length)).toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
    });
    it('returns well-known name days', () => {
        expect(nameDay(new Date(2026, 10, 16))).toBe('Otmar');
        expect(nameDay(new Date(2026, 11, 24))).toBe('Adam, Eva');
        expect(nameDay(new Date(2026, 2, 19))).toBe('Josef');
        expect(nameDay(new Date(2026, 6, 6))).toBe('Jan Hus');
    });
    it('recognises state holidays including Easter ones', () => {
        expect(holidayName(new Date(2026, 9, 28))).toContain('československého státu');
        expect(holidayName(new Date(2026, 3, 3))).toBe('Velký pátek');
        expect(holidayName(new Date(2026, 3, 6))).toBe('Velikonoční pondělí');
        expect(holidayName(new Date(2026, 10, 16))).toBe('');
    });
    it('computes the ISO week', () => {
        expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
        expect(isoWeek(new Date(2026, 10, 16))).toBe(47);
    });
});

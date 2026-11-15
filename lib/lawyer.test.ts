import { describe, expect, it } from 'vitest';
import { entryAmount, formatMinutes, hasLawyerAccess, parseDuration, timesheetCsv, type LawyerAccess, type TimeEntry } from './lawyer';

describe('lawyer helpers', () => {
    it('parses durations in common notations', () => {
        expect(parseDuration('1:30')).toBe(90);
        expect(parseDuration('1h30')).toBe(90);
        expect(parseDuration('1,5h')).toBe(90);
        expect(parseDuration('90')).toBe(90);
        expect(parseDuration('45m')).toBe(45);
        expect(parseDuration('abc')).toBe(0);
        expect(formatMinutes(95)).toBe('1:35');
    });

    it('computes amounts and CSV', () => {
        const entry: TimeEntry = { id: '1', case_id: null, entry_date: '2026-11-15', minutes: 90, description: 'Porada "A"', rate: 2000, billed: false };
        expect(entryAmount(entry)).toBe(3000);
        const csv = timesheetCsv([{ entry, caseTitle: 'Věc', client: 'Novák' }]);
        expect(csv.startsWith('﻿')).toBe(true);
        expect(csv).toContain('"Porada ""A"""');
        expect(csv).toContain('"1,50"');
    });

    it('grants access only for active or valid trial', () => {
        const base: LawyerAccess = { user_id: 'u', email: '', status: 'active', until: null, firm_name: '', default_rate: 0 };
        expect(hasLawyerAccess(null)).toBe(false);
        expect(hasLawyerAccess(base)).toBe(true);
        expect(hasLawyerAccess({ ...base, status: 'requested' })).toBe(false);
        expect(hasLawyerAccess({ ...base, status: 'trial', until: '2000-01-01' })).toBe(false);
        expect(hasLawyerAccess({ ...base, status: 'trial', until: '2999-01-01' })).toBe(true);
    });
});

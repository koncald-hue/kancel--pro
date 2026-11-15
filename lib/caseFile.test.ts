import { describe, expect, it } from 'vitest';
import { buildIcs, collectDeadlines, formatSize, safeFileName } from './caseFile';

describe('case file helpers', () => {
    it('builds an ICS file with reminders and escaped text', () => {
        const ics = buildIcs('Spor; o půjčku', [{ uid: 'a1', title: 'Odpor, 8 dní', iso: '2026-11-23' }], new Date('2026-11-15T10:00:00Z'));
        expect(ics).toContain('DTSTART;VALUE=DATE:20261123');
        expect(ics).toContain('DTEND;VALUE=DATE:20261124');
        expect(ics).toContain('SUMMARY:Lhůta: Odpor\\, 8 dní');
        expect(ics).toContain('TRIGGER:-P3D');
        expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    });

    it('merges law deadlines with custom ones in date order', () => {
        const list = collectDeadlines(
            { event_date: '2026-11-13', deadline_ids: ['odvolani-trestni-prikaz', 'neexistuje'] },
            [{ id: 'x', case_id: 'c', title: 'Jednání', due_date: '2026-11-18', done: false }],
        );
        expect(list.every((d, i) => i === 0 || d.date >= list[i - 1].date)).toBe(true);
        expect(list.some((d) => d.source === 'custom' && d.title === 'Jednání')).toBe(true);
        expect(list.some((d) => d.key === 'law-neexistuje')).toBe(false);
    });

    it('formats sizes and sanitises file names', () => {
        expect(formatSize(2048)).toBe('2 kB');
        expect(safeFileName('Příkaz č. 5 (sken).pdf')).toBe('Prikaz_c._5_sken_.pdf');
    });
});

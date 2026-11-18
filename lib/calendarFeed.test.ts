import { describe, expect, it } from 'vitest';
import { buildFeed, fold } from './calendarFeed';

const ev = { uid: 'd1', iso: '2026-12-07', title: 'Odvolání, včetně příloh; hotovo', caseId: 'c1', caseTitle: 'Novák proti Dvořákovi' };
describe('calendar feed', () => {
    it('builds all-day events with alarms and escapes special characters', () => {
        const ics = buildFeed([ev], { includeTitles: true, origin: 'https://app.example', stamp: new Date('2026-11-17T10:00:00Z') });
        expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true); expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
        expect(ics).toContain('DTSTART;VALUE=DATE:20261207'); expect(ics).toContain('DTEND;VALUE=DATE:20261208'); expect(ics).toContain('UID:d1@kancelar');
        expect(ics.replace(/\r\n /g, '')).toContain('SUMMARY:Lhůta: Odvolání\\, včetně příloh\; hotovo · Novák proti Dvořákovi');
        expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(3);
        expect(ics).toContain('URL:https://app.example/kancelar/veci/c1');
    });
    it('leaves out the case title and link unless the user allows them', () => {
        const ics = buildFeed([ev], { includeTitles: false, origin: 'https://app.example' }).replace(/\r\n /g, '');
        expect(ics).not.toContain('Novák'); expect(ics).not.toContain('URL:'); expect(ics).toContain('SUMMARY:Lhůta: Odvolání');
    });
    it('folds long lines at 75 bytes without cutting a Czech character in half', () => {
        const long = `SUMMARY:${'Příliš žluťoučký kůň úpěl ďábelské ódy '.repeat(6)}`;
        const folded = fold(long);
        for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
        expect(folded.replace(/\r\n /g, '')).toBe(long);
    });
    it('úkol v daný čas a událost od–do s místem', () => {
        const ics = buildFeed([
            { uid: 'task-1', iso: '2026-11-20', title: 'Zavolat klientovi', caseId: null, caseTitle: 'Novák', type: 'ukol' },
            { uid: 'ev-1', iso: '2026-11-20', title: 'Jednání', caseId: null, caseTitle: '', type: 'udalost', startUtc: '2026-11-20T08:30:00.000Z', endUtc: '2026-11-20T10:00:00.000Z', place: 'OS Plzeň, síň 12' },
        ], { includeTitles: false, origin: 'https://app.example', stamp: new Date('2026-11-17T10:00:00Z') }).replace(/\r\n /g, '');
        expect(ics).toContain('SUMMARY:Úkol: Zavolat klientovi'); expect(ics).not.toContain('Novák');
        expect(ics).toContain('DTSTART:20261120T083000Z'); expect(ics).toContain('DTEND:20261120T100000Z');
        expect(ics).toContain('LOCATION:OS Plzeň\\, síň 12'); expect(ics).toContain('TRIGGER:-PT30M');
    });
});

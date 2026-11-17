import { describe, expect, it } from 'vitest';
import { describe as describeWork, estimate, suggest, type Activity } from './workLog';

const a = (id: string, kind: Activity['kind'], at: string, over: Partial<Activity> = {}): Activity => ({ id, case_id: 'c1', kind, label: '', words: 0, at, time_entry_id: null, dismissed: false, ...over });

describe('work log suggestions', () => {
    it('estimates single actions, longer e-mails take longer', () => {
        expect(estimate({ kind: 'datovka_read', words: 0 })).toBe(6);
        expect(estimate({ kind: 'email_sent', words: 300 })).toBe(10);
        expect(estimate({ kind: 'email_sent', words: 100000 })).toBe(45);
    });
    it('merges close actions into one session and uses the real span when it is longer', () => {
        // 9:00 datovka (6), 9:20 e-mail (5) → jedno sezení 9:00–9:25 = 25 min
        const s = suggest([a('1', 'datovka_read', '2026-11-17T08:00:00Z'), a('2', 'email_sent', '2026-11-17T08:20:00Z')], [], { unit: 6 });
        expect(s).toHaveLength(1); expect(s[0].rawMinutes).toBe(25); expect(s[0].minutes).toBe(30);
        expect(s[0].description).toBe('Studium datové zprávy, korespondence e-mailem');
    });
    it('splits sessions after a long pause and adds them', () => {
        const s = suggest([a('1', 'datovka_read', '2026-11-17T08:00:00Z'), a('2', 'datovka_read', '2026-11-17T12:00:00Z')], [], { unit: 1 });
        expect(s[0].rawMinutes).toBe(12);
        expect(s[0].description).toBe('Studium datové zprávy (2×)');
    });
    it('groups by case and day, ignores confirmed and dismissed actions', () => {
        const s = suggest([a('1', 'document_created', '2026-11-17T08:00:00Z', { label: 'Plná moc' }), a('2', 'email_read', '2026-11-17T08:00:00Z', { case_id: null }), a('3', 'email_read', '2026-11-16T08:00:00Z'), a('4', 'email_read', '2026-11-17T09:00:00Z', { time_entry_id: 'x' }), a('5', 'email_read', '2026-11-17T09:30:00Z', { dismissed: true })], [], { unit: 15 });
        expect(s.map((x) => `${x.caseId}|${x.day}|${x.minutes}`).sort()).toEqual(['c1|2026-11-16|15', 'c1|2026-11-17|30', 'null|2026-11-17|15']);
        expect(s.find((x) => x.caseId === 'c1' && x.day === '2026-11-17')!.description).toBe('Příprava dokumentu: Plná moc');
    });
    it('subtracts time already logged for the case and day', () => {
        const acts = [a('1', 'document_created', '2026-11-17T08:00:00Z')];
        expect(suggest(acts, [{ case_id: 'c1', entry_date: '2026-11-17', minutes: 30 }], { unit: 15 })).toEqual([]);
        expect(suggest(acts, [{ case_id: 'c1', entry_date: '2026-11-17', minutes: 10 }], { unit: 15 })[0]).toMatchObject({ already: 10, minutes: 15 });
    });
    it('uses Prague days around midnight', () => {
        const s = suggest([a('1', 'email_read', '2026-11-16T23:30:00Z')], [], { unit: 1 });
        expect(s[0].day).toBe('2026-11-17');
    });
    it('describes repeated kinds once with a count', () => {
        expect(describeWork([{ kind: 'client_message', label: '' }, { kind: 'client_message', label: '' }, { kind: 'deadline_added', label: '' }])).toBe('Komunikace s klientem (2×), evidence lhůty');
    });
});

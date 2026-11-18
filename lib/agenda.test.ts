import { describe, expect, it } from 'vitest';
import { byDate, eventItems, monthGrid, pragueParts, pragueToIso, shiftMonth, taskItems, weekOf, type CalEvent, type TeamTask } from './agenda';

const task = (o: Partial<TeamTask> = {}): TeamTask => ({ id: 't1', created_by: 'boss', assignee_id: 'me', title: 'Připravit žalobu', note: '', due_date: '2026-11-20', due_time: null, priority: 'normal', case_id: null, case_title: 'Novák', status: 'open', done_at: null, answer: '', seen_at: null, created_at: '', ...o });
const ev = (o: Partial<CalEvent> = {}): CalEvent => ({ id: 'e1', user_id: 'me', title: 'Jednání', kind: 'jednani', starts_at: '2026-11-20T08:30:00Z', ends_at: '2026-11-20T10:00:00Z', all_day: false, place: 'OS Plzeň', note: '', case_id: null, case_title: '', attendees: [], ...o });

describe('agenda', () => {
    it('pražský čas v zimě i v létě a zpět', () => {
        expect(pragueParts('2026-11-20T08:30:00Z')).toEqual({ date: '2026-11-20', time: '09:30' });
        expect(pragueParts('2026-07-01T22:30:00Z')).toEqual({ date: '2026-07-02', time: '00:30' });
        expect(pragueToIso('2026-11-20', '09:30')).toBe('2026-11-20T08:30:00.000Z');
        expect(pragueToIso('2026-07-02', '00:30')).toBe('2026-07-01T22:30:00.000Z');
    });
    it('úkoly: pro mě od kolegy, ode mě pro kolegu; odmítnuté se nezobrazí', () => {
        const names = { boss: 'Petr', you: 'Jana' };
        const items = taskItems([task(), task({ id: 't2', created_by: 'me', assignee_id: 'you', due_time: '14:00:00' }), task({ id: 't3', status: 'declined' })], 'me', names);
        expect(items.map((i) => [i.sub, i.start])).toEqual([['od Petr · Novák', undefined], ['pro Jana · Novák', '14:00']]);
    });
    it('událost s časem a vícedenní celodenní událost', () => {
        expect(eventItems([ev()], 'me', {})[0]).toMatchObject({ date: '2026-11-20', start: '09:30', end: '11:00', sub: 'Jednání · OS Plzeň' });
        const multi = eventItems([ev({ all_day: true, starts_at: '2026-11-19T23:00:00Z', ends_at: '2026-11-21T23:00:00Z', user_id: 'boss' })], 'me', { boss: 'Petr' });
        expect(multi.map((i) => i.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
        expect(multi[0].sub).toContain('pozval(a) Petr');
    });
    it('mřížka měsíce od pondělí, týden a posun měsíce', () => {
        const g = monthGrid('2026-11');
        expect(g[0][0]).toBe('2026-10-26'); expect(g.at(-1)!.at(-1)).toBe('2026-12-06'); expect(g.every((w) => w.length === 7)).toBe(true);
        expect(weekOf('2026-11-18')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
        expect(shiftMonth('2026-12', 1)).toBe('2027-01'); expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    });
    it('řazení v den: lhůty, pak podle času', () => {
        const m = byDate([{ id: 'a', kind: 'tym', date: '2026-11-20', start: '14:00', title: 'b', sub: '', href: '', done: false }, { id: 'b', kind: 'lhuta', date: '2026-11-20', title: 'a', sub: '', href: '', done: false }, { id: 'c', kind: 'udalost', date: '2026-11-20', start: '09:00', title: 'c', sub: '', href: '', done: false }]);
        expect(m['2026-11-20'].map((i) => i.id)).toEqual(['b', 'c', 'a']);
    });
});

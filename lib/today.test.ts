import { describe, expect, it } from 'vitest';
import { buildAgenda, buildInbox, buildUnbilled, buildWaiting, describeSources, urgencyOf } from './today';
import { collectDeadlines, type CaseDeadline } from './caseFile';
import type { LegalCase } from './cases';
import type { TimeEntry } from './lawyer';

// Jen smyšlené údaje
const NOW = new Date('2030-03-10T09:00:00');
const mkCase = (id: string, over: Partial<LegalCase> = {}): LegalCase => ({ id, user_id: 'me', title: `Spis ${id}`, situation: '', summary: '', urgency: 'medium', steps: [], deadline_ids: [], offense_ids: [], template_keys: [], event_date: null, note: '', status: 'open', pinned: false, client_name: 'Jan Testovací', created_at: '2030-01-01T00:00:00Z', ...over });
const dl = (id: string, case_id: string, due_date: string, over: Partial<CaseDeadline> = {}): CaseDeadline => ({ id, case_id, title: `Termín ${id}`, due_date, done: false, ...over });

describe('buildAgenda', () => {
    it('sorts overdue, today, soon, later and skips done, far and closed items', () => {
        const cases = [mkCase('a'), mkCase('b'), mkCase('z', { status: 'done' })];
        const list = buildAgenda(cases, [
            dl('1', 'a', '2030-03-15'), dl('2', 'a', '2030-03-10'), dl('3', 'b', '2030-03-08'),
            dl('4', 'b', '2030-03-11'), dl('5', 'a', '2030-03-10', { done: true }), dl('6', 'a', '2030-05-01'), dl('7', 'z', '2030-03-10'),
        ], { now: NOW });
        expect(list.map((x) => x.customId)).toEqual(['3', '2', '4', '1']);
        expect(list.map((x) => x.urgency)).toEqual(['overdue', 'today', 'soon', 'later']);
    });

    it('puts unconfirmed legal deadlines before tasks on the same day', () => {
        const list = buildAgenda([mkCase('a')], [
            dl('t', 'a', '2030-03-12', { kind: 'ukol' }),
            dl('ok', 'a', '2030-03-12', { kind: 'lhuta', confirmed_at: '2030-03-01T00:00:00Z' }),
            dl('no', 'a', '2030-03-12', { kind: 'lhuta' }),
        ], { now: NOW });
        expect(list.map((x) => x.customId)).toEqual(['no', 'ok', 't']);
        expect(list.find((x) => x.customId === 'no')!.confirmed).toBe(false);
    });

    it('filters to my items: assigned to me, or unassigned in my own case', () => {
        const cases = [mkCase('a'), mkCase('s', { user_id: 'colleague' })];
        const list = buildAgenda(cases, [
            dl('1', 'a', '2030-03-11'), dl('2', 'a', '2030-03-11', { assignee_id: 'colleague' }),
            dl('3', 's', '2030-03-11'), dl('4', 's', '2030-03-11', { assignee_id: 'me' }),
        ], { now: NOW, me: 'me', onlyMine: true });
        expect(list.map((x) => x.customId).sort()).toEqual(['1', '4']);
    });
});

describe('computed (law) deadlines', () => {
    const c = mkCase('a', { deadline_ids: ['odstoupeni-eshop'], event_date: '2030-03-05' });
    it('are never marked as confirmed', () => {
        const law = collectDeadlines(c, []).filter((d) => d.source === 'law');
        expect(law.length).toBe(1);
        expect(law[0].confirmed).toBe(false);
    });
    it('disappear once the lawyer confirms them as their own record', () => {
        const key = collectDeadlines(c, [])[0].key;
        const after = collectDeadlines(c, [dl('x', 'a', '2030-03-20', { law_key: key, confirmed_at: '2030-03-06T00:00:00Z' })]);
        expect(after.filter((d) => d.source === 'law')).toHaveLength(0);
        expect(after[0]).toMatchObject({ source: 'custom', confirmed: true, iso: '2030-03-20' });
    });
    it('past computed deadlines are not shown as overdue work', () => {
        const old = mkCase('o', { deadline_ids: ['odstoupeni-eshop'], event_date: '2030-01-01' });
        expect(buildAgenda([old], [], { now: NOW })).toHaveLength(0);
    });
});

describe('buildInbox', () => {
    it('collects new inquiries, unread messages per case, uploads for open requests and signatures to check', () => {
        const cases = [mkCase('a'), mkCase('b')];
        const items = buildInbox({
            cases,
            inquiries: [
                { id: 'q1', name: 'Eva Smyšlená', message: 'Potřebuji poradit', status: 'new', created_at: '2030-03-09T10:00:00Z' },
                { id: 'q2', name: 'Petr Vzorový', message: 'x', status: 'accepted', created_at: '2030-03-01T10:00:00Z', case_id: null },
                { id: 'q3', name: 'Hotovo', message: 'x', status: 'accepted', created_at: '2030-03-01T10:00:00Z', case_id: 'a' },
                { id: 'q4', name: 'Ne', message: 'x', status: 'declined', created_at: '2030-03-01T10:00:00Z' },
            ],
            messages: [
                { case_id: 'a', from_client: true, read: false, created_at: '2030-03-09T08:00:00Z' },
                { case_id: 'a', from_client: true, read: false, created_at: '2030-03-09T09:00:00Z' },
                { case_id: 'b', from_client: true, read: true, created_at: '2030-03-09T09:00:00Z' },
            ],
            requests: [{ id: 'r1', case_id: 'b', title: 'Kopie smlouvy', done: false, created_at: '2030-03-01T00:00:00Z' }, { id: 'r2', case_id: 'b', title: 'Výpis', done: true, created_at: '2030-03-01T00:00:00Z' }],
            uploads: [{ case_id: 'b', request_id: 'r1', created_at: '2030-03-08T00:00:00Z' }, { case_id: 'b', request_id: 'r2', created_at: '2030-03-08T00:00:00Z' }],
            signatures: [{ id: 's1', case_id: 'a', title: 'Plná moc', status: 'awaiting_check', created_at: '2030-03-02T00:00:00Z' }, { id: 's2', case_id: 'a', title: 'x', status: 'pending', created_at: '2030-03-02T00:00:00Z' }],
        });
        expect(items.map((i) => i.key)).toEqual(['q-q1', 'm-a', 'r-r1', 's-s1', 'q-q2']);
        expect(items.find((i) => i.key === 'm-a')!.detail).toBe('2 nepřečtené zprávy');
        expect(items.find((i) => i.key === 'm-a')!.href).toBe('/kancelar/veci/a?tab=klient&from=dnes');
    });
});

describe('buildWaiting', () => {
    it('lists open requests without uploads, pending signatures and unanswered lawyer messages, longest wait first', () => {
        const cases = [mkCase('a'), mkCase('b'), mkCase('c')];
        const list = buildWaiting({
            cases, now: NOW,
            requests: [{ id: 'r1', case_id: 'a', title: 'Občanský průkaz', done: false, created_at: '2030-03-01T09:00:00' }, { id: 'r2', case_id: 'a', title: 'Dodáno', done: false, created_at: '2030-03-01T09:00:00' }],
            uploads: [{ case_id: 'a', request_id: 'r2', created_at: '2030-03-02T00:00:00' }],
            signatures: [{ id: 's', case_id: 'b', title: 'Smlouva', status: 'pending', created_at: '2030-03-08T09:00:00' }],
            messages: [
                { case_id: 'c', from_client: false, read: false, created_at: '2030-03-05T09:00:00' },
                { case_id: 'b', from_client: false, read: false, created_at: '2030-03-09T09:00:00' },
            ],
        });
        expect(list.map((w) => [w.caseId, w.days, w.reasons.map((r) => r.kind)])).toEqual([['a', 9, ['podklady']], ['c', 5, ['odpoved']], ['b', 2, ['podpis']]]);
    });
});

describe('buildUnbilled', () => {
    it('groups unbilled entries by case', () => {
        const e = (id: string, case_id: string | null, minutes: number, rate: number, billed = false): TimeEntry => ({ id, case_id, entry_date: '2030-03-0' + id, minutes, description: '', rate, billed });
        const list = buildUnbilled([e('1', 'a', 60, 2000), e('2', 'a', 30, 2000), e('3', null, 60, 0), e('4', 'a', 60, 2000, true)], [mkCase('a')]);
        expect(list).toEqual([
            { caseId: 'a', caseTitle: 'Spis a', minutes: 90, amount: 3000, count: 2, oldest: '2030-03-01' },
            { caseId: null, caseTitle: 'Bez spisu', minutes: 60, amount: 0, count: 1, oldest: '2030-03-03' },
        ]);
    });
});

describe('describeSources', () => {
    it('distinguishes working, not configured and missing database setup', () => {
        const s = describeSources({ inquiries: true, portal: false, isds: 0, mail: null });
        expect(s.map((x) => [x.id, x.state])).toEqual([['poptavky', 'ok'], ['klient', 'missing'], ['schranka', 'off'], ['email', 'missing']]);
        expect(urgencyOf(0)).toBe('today');
    });
});

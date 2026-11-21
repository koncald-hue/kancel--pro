import { describe, expect, it } from 'vitest';
import { desiredEvents, eventBody, googleAuthorizeUrl, hashOf, planSync, type Desired } from './googleCal';
import type { LegalCase } from './cases';
import type { CaseDeadline } from './caseFile';

const c = (id: string, title: string, extra: Partial<LegalCase> = {}): LegalCase => ({ id, title, situation: '', summary: '', urgency: 'medium', steps: [], deadline_ids: [], offense_ids: [], template_keys: [], event_date: null, note: '', status: 'open', pinned: false, created_at: '', ...extra });
const dl = (id: string, case_id: string, title: string, due_date: string, extra: Partial<CaseDeadline> = {}): CaseDeadline => ({ id, case_id, title, due_date, done: false, ...extra });
const TODAY = '2026-11-16';

describe('events wanted in the calendar', () => {
    const cases = [c('c1', 'Spor o dodávku', { client_name: 'Jan Novák' }), c('c2', 'Hotový spis', { status: 'done' })];
    it('includes open upcoming deadlines and an internal date, but not done, past or closed-case ones', () => {
        const d = desiredEvents(cases, [dl('d1', 'c1', 'Odvolání (15 dnů) – datová zpráva', '2026-11-24'), dl('d2', 'c1', 'Splněno', '2026-11-30', { done: true }), dl('d3', 'c1', 'Prošlá', '2026-11-01'), dl('d4', 'c2', 'V hotovém spisu', '2026-12-01')], { detail: 'minimal', internal: true }, TODAY, 'https://app.cz');
        expect(d.map((x) => `${x.kind}:${x.date}`)).toEqual(['main:2026-11-24', 'internal:2026-11-23']);
    });
    it('keeps client names out of the event unless the full detail is chosen', () => {
        const base = [dl('d1', 'c1', 'Odvolání', '2026-11-24', { basis: 'Doručeno 9. 11. 2026.' })];
        const min = desiredEvents(cases, base, { detail: 'minimal', internal: false }, TODAY, 'https://app.cz')[0];
        expect(min.summary).toBe('LHŮTA: Odvolání');
        expect(min.description).not.toContain('Novák');
        expect(desiredEvents(cases, base, { detail: 'vec', internal: false }, TODAY, 'https://app.cz')[0].summary).toContain('Spor o dodávku');
        const full = desiredEvents(cases, base, { detail: 'plne', internal: false }, TODAY, 'https://app.cz')[0];
        expect(full.description).toContain('Klient: Jan Novák');
        expect(full.description).toContain('Doručeno 9. 11. 2026.');
    });
    it('uses the saved internal date and skips an internal date that is not before the end', () => {
        const d = desiredEvents(cases, [dl('d1', 'c1', 'X', '2026-11-24', { internal_date: '2026-11-20' })], { detail: 'minimal', internal: true }, TODAY, 'https://app.cz');
        expect(d.find((x) => x.kind === 'internal')?.date).toBe('2026-11-20');
        const none = desiredEvents(cases, [dl('d1', 'c1', 'X', '2026-11-16')], { detail: 'minimal', internal: true }, TODAY, 'https://app.cz');
        expect(none.map((x) => x.kind)).toEqual(['main']);
    });
});

describe('event body', () => {
    it('is an all-day event ending the next day, with reminders at 9:00 and a marker for later lookup', () => {
        const d: Desired = { key: 'c1:c-d1', kind: 'main', date: '2026-12-31', summary: 'LHŮTA: X', description: 'p' };
        const b = eventBody(d, d.key);
        expect(b.start).toEqual({ date: '2026-12-31' });
        expect(b.end).toEqual({ date: '2027-01-01' });
        expect(b.reminders.overrides.map((o) => o.minutes)).toEqual([9540, 3780, 900, 900]);
        expect(b.extendedProperties.private).toMatchObject({ kancelar: '1', kind: 'main' });
    });
});

describe('sync plan', () => {
    const d1: Desired = { key: 'a', kind: 'main', date: '2026-12-01', summary: 'A', description: '' };
    const d2: Desired = { key: 'b', kind: 'main', date: '2026-12-02', summary: 'B', description: '' };
    it('inserts new, patches changed, removes vanished and skips unchanged events', () => {
        const plan = planSync([d1, d2, { ...d1, key: 'c' }], [{ key: 'a', kind: 'main', event_id: 'e1', hash: hashOf(d1) }, { key: 'b', kind: 'main', event_id: 'e2', hash: 'zastaralý' }, { key: 'x', kind: 'main', event_id: 'e3', hash: '1' }]);
        expect(plan.same).toBe(1);
        expect(plan.patch.map((p) => p.d.key)).toEqual(['b']);
        expect(plan.insert.map((d) => d.key)).toEqual(['c']);
        expect(plan.remove.map((m) => m.event_id)).toEqual(['e3']);
    });
    it('changes the hash when the date changes', () => { expect(hashOf(d1)).not.toBe(hashOf({ ...d1, date: '2026-12-03' })); });
});

describe('authorize URL', () => {
    it('asks for the narrow scope with offline access and PKCE', () => {
        const u = new URL(googleAuthorizeUrl({ clientId: 'id', redirectUri: 'http://localhost:3001/cb', challenge: 'ch', state: 's' }));
        expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.app.created');
        expect(u.searchParams.get('access_type')).toBe('offline');
        expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    });
});

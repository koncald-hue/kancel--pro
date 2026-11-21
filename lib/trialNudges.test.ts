import { describe, expect, it } from 'vitest';
import { buildNudge, nextStep, planNudge } from './trialNudges';

const now = new Date('2026-11-21T10:00:00Z');
const row = (daysAgo: number, o: Partial<Parameters<typeof planNudge>[0]> = {}) => ({ status: 'trial', created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), nudge_day2_at: null, nudge_day5_at: null, ...o });

describe('planNudge', () => {
    it('před 2. dnem nic', () => expect(planNudge(row(1), now)).toBeNull());
    it('2. den', () => expect(planNudge(row(2.5), now)).toBe('day2'));
    it('už odesláno', () => expect(planNudge(row(2.5, { nudge_day2_at: 'x' }), now)).toBeNull());
    it('5. den', () => expect(planNudge(row(5.2), now)).toBe('day5'));
    it('platící a staré účty ne', () => { expect(planNudge(row(3, { status: 'active' }), now)).toBeNull(); expect(planNudge(row(30), now)).toBeNull(); });
});
describe('buildNudge', () => {
    it('další krok podle postupu', () => {
        expect(nextStep({ cases: 0, clients: 0, links: 0, time: 0 }).path).toBe('/kancelar/veci');
        expect(nextStep({ cases: 1, clients: 0, links: 0, time: 0 }).path).toBe('/kancelar/klienti');
    });
    it('česky skloňuje dny', () => {
        const m = buildNudge('day5', { name: '', progress: { cases: 1, clients: 1, links: 1, time: 1 }, daysLeft: 2, appUrl: 'https://x.cz' });
        expect(m.subject).toContain('2 dny');
    });
});

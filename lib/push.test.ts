import { describe, expect, it } from 'vitest';
import { buildPushMessage, countDeadlines, parseSubscription } from './push';

describe('push upozornění', () => {
    it('počítá lhůty po termínu, dnešní a do 3 dnů', () => {
        const c = countDeadlines([{ due_date: '2026-11-10' }, { due_date: '2026-11-19' }, { due_date: '2026-11-21' }, { due_date: '2026-11-22' }, { due_date: '2026-11-23' }], '2026-11-19');
        expect(c).toEqual({ overdue: 1, today: 1, soon: 2 });
    });
    it('bez lhůt nic neposílá', () => { expect(buildPushMessage({ overdue: 0, today: 0, soon: 0 }, '2026-11-19')).toBeNull(); });
    it('text je obecný a správně skloňuje', () => {
        const m = buildPushMessage({ overdue: 0, today: 2, soon: 1 }, '2026-11-19')!;
        expect(m.title).toBe('Kancelář: pozor na lhůty');
        expect(m.body).toBe('Dnes končí: 2 lhůty, do 3 dnů: 1 lhůta.');
        expect(buildPushMessage({ overdue: 0, today: 0, soon: 5 }, 'x')!.body).toBe('Do 3 dnů: 5 lhůt.');
    });
    it('odmítne odběr s cizím schématem nebo špatnými klíči', () => {
        const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123456', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
        expect(parseSubscription(ok)).not.toBeNull();
        expect(parseSubscription({ ...ok, endpoint: 'http://x.cz/aaaaaaaa' })).toBeNull();
        expect(parseSubscription({ ...ok, keys: { p256dh: 'krátký', auth: 'a'.repeat(22) } })).toBeNull();
        expect(parseSubscription(null)).toBeNull();
    });
});

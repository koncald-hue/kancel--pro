import { describe, expect, it } from 'vitest';
import { IDLE_LIMIT_MS, dropSession, endAllSessions, getSession, hasSessions, putSession, touchSession } from './isdsSession';

describe('data box sessions', () => {
    it('keeps a session while it is used and expires it after idle time', () => {
        putSession('a', 'prod', 'cookie1', 1000);
        expect(getSession('a', 1000 + IDLE_LIMIT_MS - 1)?.value).toBe('cookie1');
        touchSession('a', 1000 + IDLE_LIMIT_MS - 1);
        expect(getSession('a', 1000 + IDLE_LIMIT_MS * 1.5)?.value).toBe('cookie1');
        expect(getSession('a', 1000 + IDLE_LIMIT_MS * 3)).toBeNull();
        expect(hasSessions()).toBe(false);
    });
    it('logs out every session on sign-out', async () => {
        putSession('a', 'prod', 'c1'); putSession('b', 'test', 'c2');
        const sent: string[] = [];
        await endAllSessions(async (env, s) => { sent.push(`${env}:${s}`); });
        expect(sent.sort()).toEqual(['prod:c1', 'test:c2']);
        expect(getSession('a')).toBeNull();
        dropSession('b');
    });
});

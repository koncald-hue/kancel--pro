import { describe, expect, it } from 'vitest';
import { isFreshSignup } from './signupNotice';

const now = new Date('2026-11-21T12:00:00Z').getTime();
describe('isFreshSignup', () => {
    it('čerstvě potvrzený účet ano', () => expect(isFreshSignup({ email_confirmed_at: '2026-11-21T11:50:00Z' }, now)).toBe(true));
    it('starý účet ne (aby se po nasazení neposlalo oznámení za všechny)', () => expect(isFreshSignup({ email_confirmed_at: '2026-11-10T11:50:00Z' }, now)).toBe(false));
    it('nepotvrzený ne', () => expect(isFreshSignup({ email_confirmed_at: null }, now)).toBe(false));
    it('už oznámený ne', () => expect(isFreshSignup({ email_confirmed_at: '2026-11-21T11:55:00Z', app_metadata: { signup_notified: true } }, now)).toBe(false));
});

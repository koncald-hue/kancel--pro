import { describe, expect, it } from 'vitest';
import { MS_EVENT_KEYS, MS_ID, msAuthorizeUrl, msEventBody } from './msCal';

const base = { key: 'a:b', kind: 'main' as const, date: '2026-12-31', summary: 'LHŮTA: Odvolání', description: 'Detail' };
describe('Microsoft 365 kalendář', () => {
    it('celodenní lhůta je půlnoc až půlnoc dalšího dne, bez zobrazení jako zaneprázdněný, s připomínkou 3 dny předem v 9:00', () => {
        const e = msEventBody(base);
        expect(e.isAllDay).toBe(true);
        expect(e.start).toEqual({ dateTime: '2026-12-31T00:00:00', timeZone: 'Europe/Prague' });
        expect(e.end.dateTime).toBe('2027-01-01T00:00:00');
        expect(e.showAs).toBe('free');
        expect(e.reminderMinutesBeforeStart).toBe(3 * 1440 - 540);
    });
    it('interní termín má připomínku den předem, událost v čase 30 minut předem v UTC', () => {
        expect(msEventBody({ ...base, kind: 'internal' }).reminderMinutesBeforeStart).toBe(1440 - 540);
        const t = msEventBody({ ...base, lowKey: true, startAt: '2026-12-01T09:00:00.000Z', endAt: '2026-12-01T10:00:00.000Z', location: 'Soud' });
        expect(t.isAllDay).toBe(false);
        expect(t.start).toEqual({ dateTime: '2026-12-01T09:00:00', timeZone: 'UTC' });
        expect(t.reminderMinutesBeforeStart).toBe(30);
        expect(t.location).toEqual({ displayName: 'Soud' });
    });
    it('všechna pole těla jsou na povoleném seznamu serveru', () => {
        for (const k of Object.keys(msEventBody({ ...base, location: 'x' }))) expect(MS_EVENT_KEYS).toContain(k);
    });
    it('přihlašovací adresa používá PKCE a jen oprávnění ke kalendáři', () => {
        const u = new URL(msAuthorizeUrl({ tenant: 'common', clientId: 'cid', redirectUri: 'https://x.cz/kancelar/microsoft-pripojeni', challenge: 'ch', state: 's' }));
        expect(u.hostname).toBe('login.microsoftonline.com');
        expect(u.searchParams.get('code_challenge_method')).toBe('S256');
        expect(u.searchParams.get('scope')).toBe('Calendars.ReadWrite offline_access');
    });
    it('identifikátory z Graphu projdou, cesty a mezery ne', () => {
        expect(MS_ID.test('AAMkAGI2THVSAAA=')).toBe(true);
        expect(MS_ID.test('../me/messages')).toBe(false);
        expect(MS_ID.test('a b c d e')).toBe(false);
    });
});

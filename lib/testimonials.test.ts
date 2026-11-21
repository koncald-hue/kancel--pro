import { describe, expect, it } from 'vitest';
import { shouldAskReview, validateReview, type ReviewDraft } from './testimonials';

const ok: ReviewDraft = { rating: 5, body: 'Lhůty se počítají samy a klient nahrává podklady sám.', display_name: 'JUDr. Jana Králová', role_label: 'advokátka, Plzeň', consent: true };
const DAY = 86_400_000;

describe('validateReview', () => {
    it('přijme úplnou recenzi', () => expect(validateReview(ok)).toBeNull());
    it('odmítne chybějící hvězdičky, krátký text, jméno a souhlas', () => {
        expect(validateReview({ ...ok, rating: 0 })).toMatch(/hvězdiček/);
        expect(validateReview({ ...ok, rating: 6 })).toMatch(/hvězdiček/);
        expect(validateReview({ ...ok, body: 'Dobré.' })).toMatch(/aspoň/);
        expect(validateReview({ ...ok, body: 'x'.repeat(601) })).toMatch(/Nejvýš/);
        expect(validateReview({ ...ok, display_name: ' ' })).toMatch(/jméno/);
        expect(validateReview({ ...ok, consent: false })).toMatch(/souhlas/);
    });
});

describe('shouldAskReview', () => {
    const now = new Date('2026-11-21T12:00:00Z').getTime();
    const reg = (days: number) => new Date(now - days * DAY).toISOString();
    it('zeptá se až po několika dnech zkoušení', () => {
        expect(shouldAskReview({ registeredAt: reg(2), hasReview: false, snoozedAt: null, now })).toBe(false);
        expect(shouldAskReview({ registeredAt: reg(5), hasReview: false, snoozedAt: null, now })).toBe(true);
    });
    it('neptá se po odeslání, krátce po odložení ani bez data registrace', () => {
        expect(shouldAskReview({ registeredAt: reg(30), hasReview: true, snoozedAt: null, now })).toBe(false);
        expect(shouldAskReview({ registeredAt: reg(30), hasReview: false, snoozedAt: now - 3 * DAY, now })).toBe(false);
        expect(shouldAskReview({ registeredAt: reg(30), hasReview: false, snoozedAt: now - 15 * DAY, now })).toBe(true);
        expect(shouldAskReview({ registeredAt: null, hasReview: false, snoozedAt: null, now })).toBe(false);
    });
});

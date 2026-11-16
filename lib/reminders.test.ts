import { describe, expect, it } from 'vitest';
import { LEVELS, mailtoLink, nextReminder, reminderText, type TextCtx } from './reminders';

describe('which reminder is next', () => {
    it('does nothing before the due date or without one', () => {
        expect(nextReminder('2026-11-20', [], '2026-11-16')).toBeNull();
        expect(nextReminder('2026-11-16', [], '2026-11-16')).toBeNull();
        expect(nextReminder(null, [], '2026-11-16')).toBeNull();
    });
    it('starts with level 1 after three days overdue, shows when it becomes ready', () => {
        expect(nextReminder('2026-11-10', [], '2026-11-12')).toMatchObject({ level: 1, ready: false, readyOn: '2026-11-13', overdueDays: 2 });
        expect(nextReminder('2026-11-10', [], '2026-11-13')).toMatchObject({ level: 1, ready: true });
    });
    it('keeps a gap after the previous reminder and after the due date for the next level', () => {
        const sent = [{ level: 1 as const, sent_on: '2026-11-13' }];
        expect(nextReminder('2026-11-10', sent, '2026-11-20')).toMatchObject({ level: 2, ready: false, readyOn: '2026-11-24' });
        expect(nextReminder('2026-11-10', sent, '2026-11-24')).toMatchObject({ level: 2, ready: true });
        expect(nextReminder('2026-10-01', sent, '2026-11-20')).toMatchObject({ level: 2, ready: true });
    });
    it('goes to the pre-action letter and then stops', () => {
        const l2 = [{ level: 1 as const, sent_on: '2026-10-20' }, { level: 2 as const, sent_on: '2026-11-05' }];
        expect(nextReminder('2026-10-10', l2, '2026-11-16')).toMatchObject({ level: 3, ready: true });
        expect(nextReminder('2026-10-10', [...l2, { level: 3, sent_on: '2026-11-10' }], '2026-12-20')).toBeNull();
        expect(LEVELS[3].minAfterDue).toBe(30);
    });
});

const ctx: TextCtx = { level: 1, number: '2026-001', issue: '2026-10-01', due: '2026-10-15', outstanding: 10000, currency: 'CZK', account: '19-2000145399/0800', vs: '2026001', signature: 'JUDr. Jan Novák', today: '2026-11-16', lastSentOn: '2026-10-20' };

describe('reminder wording', () => {
    it('level 1 names the invoice, the amount, a payment deadline and the account with the variable symbol', () => {
        const d = reminderText(ctx);
        expect(d.subject).toBe('Upomínka k úhradě faktury č. 2026-001');
        expect(d.body).toContain('faktury č. 2026-001 ze dne 1. 10. 2026, splatné 15. 10. 2026');
        expect(d.body).toContain('do 23. 11. 2026');
        expect(d.body).toContain('CZ65 0800 0000 1920 0014 5399, variabilní symbol 2026001');
        expect(d.body.endsWith('JUDr. Jan Novák')).toBe(true);
    });
    it('level 2 adds statutory default interest computed for the due date', () => {
        const d = reminderText({ ...ctx, level: 2 });
        expect(d.interestRate).toBe(11.75);
        expect(d.interest).toBeGreaterThan(0);
        expect(d.body).toContain('351/2013 Sb.');
        expect(d.body).toContain('ze dne 20. 10. 2026');
    });
    it('level 3 is a pre-action letter with the total and costs warning', () => {
        const d = reminderText({ ...ctx, level: 3 });
        expect(d.subject).toContain('Předžalobní výzva');
        expect(d.body).toContain('náhradu nákladů řízení');
        expect(d.body).toContain('celkem');
    });
    it('skips interest for euro invoices and builds a mailto link', () => {
        const d = reminderText({ ...ctx, level: 2, currency: 'EUR' });
        expect(d.interestRate).toBeNull();
        expect(d.body).not.toContain('351/2013');
        expect(mailtoLink('a@b.cz', d)).toMatch(/^mailto:a%40b\.cz\?subject=/);
    });
});

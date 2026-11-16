import { describe, expect, it } from 'vitest';
import { isEmail, maskEmail, sendMail } from './mail';

describe('mail', () => {
    it('masks and validates addresses', () => {
        expect(maskEmail('jan.novak@example.cz')).toBe('j••••••••@example.cz');
        expect(maskEmail('x')).toBe('***');
        expect(isEmail('a@b.cz')).toBe(true); expect(isEmail('a@b')).toBe(false);
    });
    it('calls Resend or Brevo with the right payload', async () => {
        const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
        const f = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> }); return new Response('{}'); }) as unknown as typeof fetch;
        process.env.MAIL_FROM = 'Kancelář <noreply@example.cz>';
        process.env.RESEND_API_KEY = 'rk'; delete process.env.BREVO_API_KEY;
        await sendMail('a@b.cz', 'Kód', 'Text', f);
        expect(calls[0].url).toBe('https://api.resend.com/emails'); expect(calls[0].body).toMatchObject({ from: 'Kancelář <noreply@example.cz>', to: ['a@b.cz'] });
        delete process.env.RESEND_API_KEY; process.env.BREVO_API_KEY = 'bk';
        await sendMail('a@b.cz', 'Kód', 'Text', f);
        expect(calls[1].url).toBe('https://api.brevo.com/v3/smtp/email'); expect(calls[1].body).toMatchObject({ sender: { name: 'Kancelář', email: 'noreply@example.cz' }, to: [{ email: 'a@b.cz' }] });
        delete process.env.BREVO_API_KEY;
        await expect(sendMail('a@b.cz', 'x', 'y', f)).rejects.toThrow();
    });
});

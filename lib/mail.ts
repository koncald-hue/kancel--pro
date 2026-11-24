import { htmlFromText } from './mailHtml';

// Odeslání e-mailu (server) přes HTTP rozhraní poskytovatele. Podporované: Resend (RESEND_API_KEY) a Brevo (BREVO_API_KEY).
// Odesílatel MAIL_FROM musí být u poskytovatele ověřený. Bez klíče se e-maily neodesílají.
export const mailConfigured = () => !!((process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) && process.env.MAIL_FROM);

export type MailAttachment = { name: string; content: string };
export async function sendMail(to: string, subject: string, text: string, f: typeof fetch = fetch, attachments: MailAttachment[] = [], replyTo?: string): Promise<void> {
    const b64 = (a: MailAttachment) => Buffer.from(a.content, 'utf8').toString('base64');
    const from = process.env.MAIL_FROM ?? '';
    const html = htmlFromText(text, process.env.NEXT_PUBLIC_SITE_URL || 'https://kancelarpro.cz');
    if (process.env.RESEND_API_KEY) {
        const res = await f('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}), ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.name, content: b64(a) })) } : {}) }), cache: 'no-store' });
        if (!res.ok) { console.warn(`[mail] Resend ${res.status}`); throw new Error('E-mail se nepodařilo odeslat.'); }
        return;
    }
    if (process.env.BREVO_API_KEY) {
        const m = from.match(/^(.*?)\s*<([^>]+)>$/); const sender = m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2] } : { email: from };
        const res = await f('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ sender, to: [{ email: to }], ...(replyTo ? { replyTo: { email: replyTo } } : {}), subject, textContent: text, htmlContent: html, ...(attachments.length ? { attachment: attachments.map((a) => ({ name: a.name, content: b64(a) })) } : {}) }), cache: 'no-store' });
        if (!res.ok) {
            // Do logu serveru jen kód a hláška poskytovatele (bez příjemce a obsahu), např. zablokovaná IP adresa
            const why = await res.json().catch(() => null) as { code?: string; message?: string } | null;
            console.warn(`[mail] Brevo ${res.status} ${why?.code ?? ''}: ${(why?.message ?? '').slice(0, 200)}`);
            throw new Error('E-mail se nepodařilo odeslat.');
        }
        return;
    }
    throw new Error('Odesílání e-mailů není nastavené.');
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export function maskEmail(e: string): string {
    const [u, d] = e.split('@'); if (!d) return '***';
    return `${u.slice(0, 1)}${'•'.repeat(Math.max(2, u.length - 1))}@${d}`;
}

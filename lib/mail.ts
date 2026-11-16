// Odeslání e-mailu (server) přes HTTP rozhraní poskytovatele. Podporované: Resend (RESEND_API_KEY) a Brevo (BREVO_API_KEY).
// Odesílatel MAIL_FROM musí být u poskytovatele ověřený. Bez klíče se e-maily neodesílají.
export const mailConfigured = () => !!((process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) && process.env.MAIL_FROM);

export async function sendMail(to: string, subject: string, text: string, f: typeof fetch = fetch): Promise<void> {
    const from = process.env.MAIL_FROM ?? '';
    if (process.env.RESEND_API_KEY) {
        const res = await f('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text }), cache: 'no-store' });
        if (!res.ok) throw new Error('E-mail se nepodařilo odeslat.');
        return;
    }
    if (process.env.BREVO_API_KEY) {
        const m = from.match(/^(.*?)\s*<([^>]+)>$/); const sender = m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2] } : { email: from };
        const res = await f('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text }), cache: 'no-store' });
        if (!res.ok) throw new Error('E-mail se nepodařilo odeslat.');
        return;
    }
    throw new Error('Odesílání e-mailů není nastavené.');
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export function maskEmail(e: string): string {
    const [u, d] = e.split('@'); if (!d) return '***';
    return `${u.slice(0, 1)}${'•'.repeat(Math.max(2, u.length - 1))}@${d}`;
}

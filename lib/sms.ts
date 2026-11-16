// Odeslání SMS (server). Zatím jen Twilio; bez nastavení TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN a TWILIO_FROM (nebo TWILIO_MESSAGING_SERVICE_SID) se SMS neodesílají.
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));
// Vývojový režim: kód se vrátí v odpovědi místo SMS. Nikdy v ostrém provozu.
export const devOtp = () => process.env.SIGN_DEV_OTP === '1' && process.env.NODE_ENV !== 'production';

export async function sendSms(to: string, body: string, f: typeof fetch = fetch): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID; const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('SMS brána není nastavená.');
    const form = new URLSearchParams({ To: to, Body: body });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID); else form.set('From', process.env.TWILIO_FROM ?? '');
    const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(), cache: 'no-store' });
    if (!res.ok) throw new Error('SMS se nepodařilo odeslat.');
}

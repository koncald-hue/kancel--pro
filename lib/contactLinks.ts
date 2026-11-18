// Odkazy pro kontakt s klientem: hovor, SMS, WhatsApp a e-mail. Telefon se převede na mezinárodní tvar (výchozí předvolba ČR).
export function phoneE164(phone: string, defaultCc = '420'): string | null {
    const raw = phone.trim();
    if (!raw) return null;
    let d = raw.replace(/[^\d+]/g, '');
    if (d.startsWith('00')) d = `+${d.slice(2)}`;
    if (!d.startsWith('+')) {
        const digits = d.replace(/\D/g, '');
        if (digits.length === 9) d = `+${defaultCc}${digits}`;
        else if (digits.length >= 11 && digits.length <= 15) d = `+${digits}`;
        else return null;
    }
    const digits = d.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}
export const telHref = (phone: string) => { const p = phoneE164(phone); return p ? `tel:${p}` : null; };
export const smsHref = (phone: string, body = '') => { const p = phoneE164(phone); return p ? `sms:${p}${body ? `?&body=${encodeURIComponent(body)}` : ''}` : null; };
export const whatsappHref = (phone: string) => { const p = phoneE164(phone); return p ? `https://wa.me/${p.slice(1)}` : null; };
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const mailtoHref = (email: string, subject = '') => (isEmail(email) ? `mailto:${encodeURIComponent(email.trim())}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}` : null);
// Tisk telefonu po trojicích: +420 777 777 777
export function prettyPhone(phone: string): string {
    const p = phoneE164(phone);
    if (!p) return phone;
    if (p.startsWith('+420') && p.length === 13) return `+420 ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
    return p;
}

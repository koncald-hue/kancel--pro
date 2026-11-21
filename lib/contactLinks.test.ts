import { describe, expect, it } from 'vitest';
import { mailtoHref, phoneE164, prettyPhone, smsHref, telHref, whatsappHref } from './contactLinks';

describe('contactLinks', () => {
    it('převede české i mezinárodní tvary', () => {
        expect(phoneE164('777 777 777')).toBe('+420777777777');
        expect(phoneE164('+420 777-777-777')).toBe('+420777777777');
        expect(phoneE164('00421 905 123 456')).toBe('+421905123456');
        expect(phoneE164('420777777777')).toBe('+420777777777');
        expect(phoneE164('12345')).toBeNull(); expect(phoneE164('')).toBeNull();
    });
    it('odkazy pro hovor, SMS, WhatsApp a e-mail', () => {
        expect(telHref('777777777')).toBe('tel:+420777777777');
        expect(smsHref('777777777', 'Dobrý den')).toBe('sms:+420777777777?&body=Dobr%C3%BD%20den');
        expect(whatsappHref('+420 777 777 777')).toBe('https://wa.me/420777777777');
        expect(mailtoHref('jan@firma.cz', 'Spis')).toBe('mailto:jan%40firma.cz?subject=Spis');
        expect(mailtoHref('neni-email')).toBeNull(); expect(telHref('abc')).toBeNull();
    });
    it('hezký zápis čísla', () => { expect(prettyPhone('777777777')).toBe('+420 777 777 777'); expect(prettyPhone('x')).toBe('x'); });
});

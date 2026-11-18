import type { LegalCase } from './cases';

// Údaje věci jako text pro vložení do dokumentu (hlavička podání, dopisu)
export function clientBlock(c: Pick<LegalCase, 'title' | 'client_name' | 'reference' | 'authority' | 'client_email' | 'client_phone'>, firm = ''): string {
    return [
        c.reference ? `Spisová značka: ${c.reference}` : '',
        c.authority ? `Soud / úřad: ${c.authority}` : '',
        c.client_name ? `Klient: ${c.client_name}` : '',
        `Věc: ${c.title}`,
        c.client_email ? `E-mail klienta: ${c.client_email}` : '',
        c.client_phone ? `Telefon klienta: ${c.client_phone}` : '',
        firm ? `Zastoupení: ${firm}` : '',
    ].filter(Boolean).join('\n') + '\n';
}

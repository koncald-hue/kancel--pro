import type { LegalCase } from './cases';

// Údaje věci jako text pro vložení do dokumentu (hlavička podání, dopisu)
export function clientBlock(c: Pick<LegalCase, 'title' | 'client_name' | 'reference' | 'authority' | 'client_email' | 'client_phone'>, firm = ''): string {
    return [
        c.reference ? `Spisová značka: ${c.reference}` : '',
        c.authority ? `Soud / úřad: ${c.authority}` : '',
        c.client_name ? `Klient: ${c.client_name}` : '',
        `Spis: ${c.title}`,
        c.client_email ? `E-mail klienta: ${c.client_email}` : '',
        c.client_phone ? `Telefon klienta: ${c.client_phone}` : '',
        firm ? `Zastoupení: ${firm}` : '',
    ].filter(Boolean).join('\n') + '\n';
}

// Nesplněné lhůty věci jako text pro vložení do dokumentu (např. do přípisu klientovi), od nejbližší
export function deadlinesBlock(deadlines: { title: string; due_date: string; done: boolean }[]): string {
    const open = deadlines.filter((d) => !d.done && d.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (!open.length) return '';
    const cz = (iso: string) => `${Number(iso.slice(8, 10))}. ${Number(iso.slice(5, 7))}. ${iso.slice(0, 4)}`;
    return `Lhůty ve věci:\n${open.map((d) => `– ${cz(d.due_date)}: ${d.title}`).join('\n')}\n`;
}

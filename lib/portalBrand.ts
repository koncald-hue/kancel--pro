// Vzhled klientské stránky: barva je jen klíč z pevné nabídky (nikdy volný text), uvítání je prostý text.
export const ACCENTS = { indigo: { label: 'Indigo', hex: '#4338ca' }, emerald: { label: 'Zelená', hex: '#047857' }, rose: { label: 'Růžová', hex: '#be123c' }, amber: { label: 'Oranžová', hex: '#b45309' }, sky: { label: 'Modrá', hex: '#0369a1' }, slate: { label: 'Šedá', hex: '#334155' } } as const;
export type AccentKey = keyof typeof ACCENTS;
export const accentOf = (v: unknown): AccentKey => (typeof v === 'string' && v in ACCENTS ? (v as AccentKey) : 'indigo');
export const greetingOf = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 300) : '');

// Text připomenutí podkladů: jen otevřené žádosti, ke kterým klient zatím nic nenahrál
export function reminderText(openTitles: string[], url: string, name = ''): string {
    const list = openTitles.map((t) => `• ${t}`).join('\n');
    return `Dobrý den${name ? `, ${name}` : ''},\n\nrád(a) bych vás požádal(a) o doplnění těchto podkladů k vašemu spisu:\n${list}\n\nNahrát je můžete na svém soukromém odkazu:\n${url}\n\nOdkaz otevřete celý, včetně části za znakem #, a nikomu ho nepředávejte. Děkuji.`;
}

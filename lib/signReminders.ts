import { REMINDER_DAYS } from './signing';

// Texty e-mailů o podpisech. Klientský odkaz se do e-mailu nevkládá (klíč šifrování je jen v odkazu, který klient dostal od advokáta).
const dateCz = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });

export const remindersElapsed = (createdAt: string, now = new Date()) => REMINDER_DAYS.filter((d) => (now.getTime() - new Date(createdAt).getTime()) / 86_400_000 >= d).length;

export function buildClientReminder(i: { lawyer: string; titles: string[]; expiresAt: string | null }): { subject: string; text: string } {
    const many = i.titles.length > 1;
    return {
        subject: many ? 'Připomínka: dokumenty čekají na váš podpis' : 'Připomínka: dokument čeká na váš podpis',
        text: [
            'Dobrý den,',
            '',
            `${many ? 'Dokumenty' : 'Dokument'} od ${i.lawyer || 'vašeho advokáta'} čeká na váš podpis:`,
            ...i.titles.map((t) => `• ${t}`),
            '',
            `Otevřete odkaz na klientskou stránku, který jste od advokáta dostali, a v záložce Podpisy ${many ? 'je' : 'ho'} podepište${i.expiresAt ? `. Žádost platí do ${dateCz(i.expiresAt)}` : ''}.`,
            'Odkaz jsme sem z bezpečnostních důvodů nevkládali. Pokud ho nemůžete najít, napište advokátovi.',
            '',
            'Tento e-mail je automatická připomínka.',
        ].join('\n'),
    };
}

export function buildExpiryNotice(i: { who: string; titles: string[] }): { subject: string; text: string } {
    return {
        subject: `Podpis nebyl dokončen: ${i.who || 'klient'}`,
        text: [
            'Dobrý den,',
            '',
            `platnost žádosti o podpis vypršela a klient ${i.who || ''} dokumenty nepodepsal:`,
            ...i.titles.map((t) => `• ${t}`),
            '',
            'V Kanceláři Pro ve spisu otevřete záložku Podpisy a pošlete žádost znovu, případně klienta kontaktujte.',
        ].join('\n'),
    };
}

// E-mail o smazání účtu správcem. Posílá se až po úspěšném smazání.
export function buildAccountDeleted(origin = 'https://kancelarpro.cz'): { subject: string; text: string } {
    const base = origin.replace(/\/$/, '');
    return {
        subject: 'Váš účet v Kanceláři Pro byl smazán',
        text: [
            'Váš účet byl smazán',
            '',
            'Dobrý den,',
            'váš účet v Kanceláři Pro byl smazán správcem. Přihlášení i všechna data účtu (spisy, klienti, lhůty, soubory a nastavení) jsme odstranili a nelze je obnovit.',
            '',
            'Pokud se domníváte, že jde o omyl, odpovězte na tento e-mail. Kdykoli se můžete znovu zaregistrovat:',
            base,
        ].join('\n'),
    };
}

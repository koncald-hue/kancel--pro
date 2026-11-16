import { getEasterSunday } from './workdays';

// České jmeniny podle běžného kalendáře (měsíc po měsíci, od 1. dne). Kalendář se v drobnostech mezi lety mírně liší.
const MONTHS: string[] = [
    'Nový rok|Karina|Radmila|Diana|Dalimil|Tři králové|Vilma|Čestmír|Vladan|Břetislav|Bohdana|Pravoslav|Edita|Radovan|Alice|Ctirad|Drahoslav|Vladislav|Doubravka|Ilona|Běla|Slavomír|Zdeněk|Milena|Miloš|Zora|Ingrid|Otýlie|Zdislava|Robin|Marika',
    'Hynek|Nela|Blažej|Jarmila|Dobromila|Vanda|Veronika|Milada|Apolena|Mojmír|Božena|Slavěna|Věnceslav|Valentýn|Jiřina|Ljuba|Miloslava|Gizela|Patrik|Oldřich|Lenka|Petr|Svatopluk|Matěj|Liliana|Dorota|Alexandr|Lumír|Horymír',
    'Bedřich|Anežka|Kamil|Stela|Kazimír|Miroslav|Tomáš|Gabriela|Františka|Viktorie|Anděla|Řehoř|Růžena|Rút, Matylda|Ida|Elena, Herbert|Vlastimil|Eduard|Josef|Světlana|Radek|Leona|Ivona|Gabriel|Marián|Emanuel|Dita|Soňa|Taťána|Arnošt|Kvido',
    'Hugo|Erika|Richard|Ivana|Miroslava|Vendula|Heřman, Hermína|Ema|Dušan|Darja|Izabela|Julius|Aleš|Vincenc|Anastázie|Irena|Rudolf|Valérie|Rostislav|Marcela|Alexandra|Evžénie|Vojtěch|Jiří|Marek|Oto|Jaroslav|Vlastislav|Robert|Blahoslav',
    'Svátek práce|Zikmund|Alexej|Květoslav|Klaudie|Radoslav|Stanislav|Den vítězství|Ctibor|Blažena|Svatava|Pankrác|Servác|Bonifác|Žofie|Přemysl|Aneta|Nataša|Ivo|Zbyšek|Monika|Emil|Vladimír|Jana|Viola|Filip|Valdemar|Vilém|Maxmilián|Ferdinand|Kamila',
    'Laura|Jarmil|Tamara|Dalibor|Dobroslav|Norbert|Iveta, Slavoj|Medard|Stanislava|Gita|Bruno|Antonie|Antonín|Roland|Vít|Zbyněk|Adolf|Milan|Leoš|Květa|Alois|Pavla|Zdeňka|Jan|Ivan|Adriana|Ladislav|Lubomír|Petr a Pavel|Šárka',
    'Jaroslava|Patricie|Radomír|Prokop|Cyril a Metoděj|Jan Hus|Bohuslava|Nora|Drahoslava|Libuše, Amálie|Olga|Bořek|Markéta|Karolína|Jindřich|Luboš|Martina|Drahomíra|Čeněk|Ilja|Vítězslav|Magdaléna|Libor|Kristýna|Jakub|Anna|Věroslav|Viktor|Marta|Bořivoj|Ignác',
    'Oskar|Gustav|Miluše|Dominik|Kristián|Oldřiška|Lada|Soběslav|Roman|Vavřinec|Zuzana|Klára|Alena|Alan|Hana|Jáchym|Petra|Helena|Ludvík|Bernard|Johana|Bohuslav|Sandra|Bartoloměj|Radim|Luděk|Otakar|Augustin|Evelína|Vladěna|Pavlína',
    'Linda, Samuel|Adéla|Bronislav|Jindřiška|Boris|Boleslav|Regína|Mariana|Daniela|Irma|Denisa|Marie|Lubor|Radka|Jolana|Ludmila|Naděžda|Kryštof|Zita|Oleg|Matouš|Darina|Berta|Jaromír|Zlata|Andrea|Jonáš|Václav|Michal|Jeroným',
    'Igor|Olívie, Oliver|Bohumil|František|Eliška|Hanuš|Justýna|Věra|Štefan, Sára|Marina|Andrej|Marcel|Renáta|Agáta|Tereza|Havel|Hedvika|Lukáš|Michaela|Vendelín|Brigita|Sabina|Teodor|Nina|Beáta|Erik|Šarlota, Zoe|Den vzniku ČSR|Silvie|Tadeáš|Štěpánka',
    'Felix|Památka zesnulých|Hubert|Karel|Miriam|Liběna|Saskie|Bohumír|Bohdan|Evžen|Martin|Benedikt|Tibor|Sáva|Leopold|Otmar|Mahulena|Romana|Alžběta|Nikola|Albert|Cecílie|Klement|Emílie|Kateřina|Artur|Xenie|René|Zina|Ondřej',
    'Iva|Blanka|Svatoslav|Barbora|Jitka|Mikuláš|Ambrož, Benjamín|Květoslava|Vratislav|Julie|Dana|Simona|Lucie|Lýdie|Radana, Radan|Albína|Daniel|Miloslav|Ester|Dagmar|Natálie|Šimon|Vlasta|Adam, Eva|Boží hod|Štěpán|Žaneta|Bohumila|Judita|David|Silvestr',
];
export const NAME_DAYS: string[][] = MONTHS.map((m) => m.split('|'));

// Co je v daný den v kalendáři (jméno, případně svátek)
export const nameDay = (date: Date): string => NAME_DAYS[date.getMonth()]?.[date.getDate() - 1] ?? '';

const FIXED_HOLIDAYS: Record<string, string> = {
    '01-01': 'Nový rok, Den obnovy samostatného českého státu', '05-01': 'Svátek práce', '05-08': 'Den vítězství', '07-05': 'Den slovanských věrozvěstů Cyrila a Metoděje',
    '07-06': 'Den upálení mistra Jana Husa', '09-28': 'Den české státnosti', '10-28': 'Den vzniku samostatného československého státu', '11-17': 'Den boje za svobodu a demokracii',
    '12-24': 'Štědrý den', '12-25': '1. svátek vánoční', '12-26': '2. svátek vánoční',
};

// Název státního svátku, nebo prázdný řetězec
export function holidayName(date: Date): string {
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (FIXED_HOLIDAYS[key]) return FIXED_HOLIDAYS[key];
    const easter = getEasterSunday(date.getFullYear());
    const same = (offset: number) => { const d = new Date(easter); d.setDate(easter.getDate() + offset); return d.toDateString() === date.toDateString(); };
    if (same(-2)) return 'Velký pátek';
    if (same(1)) return 'Velikonoční pondělí';
    return '';
}

// Číslo týdne podle ISO 8601
export function isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
}

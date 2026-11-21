import { FIELDS, fold, scoreMapping, type Entity, type Mapping } from './importer';

// Předvolby mapování sloupců pro přechod z jiných advokátních systémů.
// POZOR: názvy sloupců vycházejí z běžné terminologie a z veřejně dostupných popisů, NE z ověřených exportů těchto systémů.
// Proto je mapování vždy jen návrh: uživatel vidí náhled a každý sloupec může změnit. Po prvním skutečném exportu
// se předvolba upraví přidáním přesných názvů do seznamu níže.
export type PresetId = 'auto' | 'evolio' | 'singlecase' | 'excel';
export type Preset = { id: PresetId; label: string; hint: string; extra: Partial<Record<Entity, Record<string, string[]>>> };

export const PRESETS: Preset[] = [
    { id: 'auto', label: 'Poznat automaticky', hint: 'Podle názvů sloupců.', extra: {} },
    {
        id: 'evolio', label: 'Evolio', hint: 'Export seznamu spisů, klientů, výkonů a lhůt do Excelu nebo CSV.',
        extra: {
            klienti: { name: ['nazev jmeno', 'nazev prijmeni', 'subjekt', 'klient nazev', 'jmeno nazev'], ico: ['ic', 'ico klienta', 'ic dph'], dic: ['dic klienta'], street: ['ulice cislo popisne', 'ulice a c p'], note: ['interni poznamka', 'poznamka k subjektu'] },
            veci: { title: ['nazev spisu', 'predmet spisu', 'spis nazev', 'kauza nazev'], reference: ['cislo spisu soudu', 'spisova znacka soudu', 'sp zn soudu', 'znacka soudu', 'cj soudu', 'sp zn organu'], authority: ['soud organ', 'organ', 'vedouci organ'], client: ['klient spisu', 'klient nazev', 'zadatel'], status: ['stav spisu', 'faze spisu'], description: ['popis spisu', 'predmet sporu'] },
            lhuty: { case: ['cislo spisu', 'spis cislo', 'nazev spisu', 'spis nazev'], title: ['nazev ukolu', 'ukol', 'nazev terminu', 'popis terminu'], date: ['datum terminu', 'termin do', 'konec lhuty', 'splnit do', 'datum splnitelnosti'], done: ['dokonceno', 'hotovo', 'splneno'] },
            kontakty: { case: ['cislo spisu', 'nazev spisu'], role: ['role ve spisu', 'postaveni ve spisu', 'typ strany'] },
            cas: { case: ['cislo spisu', 'nazev spisu', 'spis nazev'], date: ['datum vykonu', 'datum prace', 'datum cinnosti'], hours: ['hodiny vykonu', 'pocet hodin', 'odpracovane hodiny'], minutes: ['minuty vykonu', 'odpracovane minuty', 'delka minut'], description: ['popis vykonu', 'popis cinnosti', 'nazev vykonu', 'vykon'], rate: ['hodinova sazba kc', 'sazba za hodinu'], billed: ['vyuctovano', 'fakturovano', 'zauctovano'] },
        },
    },
    {
        id: 'singlecase', label: 'SingleCase', hint: 'Export seznamu věcí, kontaktů a časových záznamů do Excelu nebo CSV.',
        extra: {
            klienti: { name: ['klient', 'kontakt', 'kontakt nazev', 'contact name', 'client name', 'company name'], company: ['spolecnost', 'nazev spolecnosti'], ico: ['ico', 'ic', 'company id'], email: ['email adresa', 'e mail', 'primary email'], phone: ['telefon', 'mobil', 'primary phone'] },
            veci: { title: ['matter name', 'matter', 'nazev veci', 'nazev spisu', 'vec nazev', 'nazev kauzy'], reference: ['matter number', 'cislo veci', 'cislo spisu', 'spisova znacka', 'sp zn'], authority: ['court', 'soud', 'urad'], client: ['client', 'client name', 'klient'], status: ['status', 'matter status', 'stav veci'] },
            lhuty: { case: ['matter', 'matter name', 'matter number', 'vec', 'cislo veci'], title: ['task', 'subject', 'nazev ukolu', 'ukol', 'predmet'], date: ['due date', 'deadline', 'termin', 'datum splneni'], done: ['completed', 'done', 'dokonceno', 'splneno'] },
            cas: { case: ['matter', 'matter name', 'matter number', 'vec', 'cislo veci'], date: ['date', 'datum', 'datum zapisu'], hours: ['hours', 'hodiny', 'cas hodiny', 'quantity'], minutes: ['minutes', 'minuty'], duration: ['duration', 'cas', 'delka'], description: ['narrative', 'description', 'popis', 'popis cinnosti', 'activity'], rate: ['rate', 'hourly rate', 'sazba'], billed: ['billed', 'invoiced', 'vyfakturovano'] },
        },
    },
    { id: 'excel', label: 'Vlastní Excel / tabulka', hint: 'Libovolná tabulka s hlavičkou. Sloupce si přiřadíte sami.', extra: {} },
];

export const presetById = (id: PresetId) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

// Návrh mapování: přesné názvy z předvolby mají přednost, potom obecné rozpoznání podle slov a obsahu sloupců
export function suggestWithPreset(entity: Entity, headers: string[], presetId: PresetId, rows: string[][] = []): Mapping {
    return scoreMapping(entity, headers, rows, presetById(presetId).extra[entity] ?? {}).mapping;
}

// Nabídne předvolbu, pokud aspoň 3 sloupce souboru odpovídají jejím specifickým názvům (ne obecným synonymům)
export function guessPreset(entity: Entity, headers: string[]): PresetId | null {
    const f = headers.map(fold); let best: { id: PresetId; hits: number } | null = null;
    for (const p of PRESETS) {
        if (p.id === 'auto' || p.id === 'excel') continue;
        const general = new Set(FIELDS[entity].flatMap((d) => d.synonyms));
        const specific = new Set(Object.values(p.extra[entity] ?? {}).flat().filter((s) => !general.has(s)));
        const hits = f.filter((h) => specific.has(h)).length;
        if (hits >= 3 && (!best || hits > best.hits)) best = { id: p.id, hits };
    }
    return best?.id ?? null;
}

// Údaje provozovatele pro obchodní podmínky, zpracovatelskou smlouvu a zásady ochrany osobních údajů.
// DOPLŇTE všechny prázdné položky před zveřejněním. Spusťte `npm run check:legal`, ukáže, co chybí.
// Prázdná položka se na stránkách zobrazí jako zvýrazněné „[DOPLNIT: …]“.
export const PROVIDER = {
    name: 'Dominik Končal', // obchodní firma nebo jméno a příjmení (OSVČ)
    ico: '30292620',     // IČO
    vat: 'není plátcem DPH', // DIČ, nebo napište „není plátcem DPH“
    address: 'K Cihelně 47, 330 12 Horní Bříza',         // sídlo / místo podnikání
    register: 'fyzická osoba zapsaná v živnostenském rejstříku vedeném Magistrátem města Plzně',        // zápis v rejstříku (např. „vedená u Městského soudu v Praze, sp. zn. C 12345“) nebo „zapsán v živnostenském rejstříku“
    email: 'dominikkoncal@gmail.com', // kontaktní e-mail pro zákazníky a pro oznamování incidentů
    phone: '+420 735 762 729', // telefon (nepovinné)
    dataProtectionEmail: 'dominikkoncal@gmail.com', // e-mail pro žádosti o ochranu osobních údajů (může být stejný jako e-mail výše)
    hosting: 'Vercel Inc., region Dublin, Irsko (EU)', // kde aplikace běží (např. „Vercel Inc.“) a v jakém regionu
    dbRegion: 'Irsko (EU)', // region databáze Supabase (např. „Frankfurt, EU“)
    mailProvider: 'Brevo (Sendinblue SAS)',    // poskytovatel e-mailů (např. „Resend“), až bude zapojen
    paymentProvider: 'Comgate a.s.', // platební brána (např. „Stripe“), až bude zapojena
    effectiveFrom: '27. 11. 2026',   // datum účinnosti znění podmínek (např. „1. 12. 2026“)
};

export type ProviderKey = keyof typeof PROVIDER;

// Verze znění; uloží se spolu se souhlasem při registraci. Při každé změně podmínek ji zvyšte.
export const TERMS_VERSION = '2026-2';

// Jak dlouho po skončení přístupu se data uchovají (měsíce), než se smažou
export const RETENTION_MONTHS = 12;
// Zkušební doba (dny)
export const TRIAL_DAYS = 14;

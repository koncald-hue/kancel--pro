// Údaje provozovatele pro obchodní podmínky, zpracovatelskou smlouvu a zásady ochrany osobních údajů.
// DOPLŇTE všechny prázdné položky před zveřejněním. Spusťte `npm run check:legal`, ukáže, co chybí.
// Prázdná položka se na stránkách zobrazí jako zvýrazněné „[DOPLNIT: …]“.
export const PROVIDER = {
    name: '',            // obchodní firma nebo jméno a příjmení (OSVČ)
    ico: '',             // IČO
    vat: '',             // DIČ, nebo napište „není plátcem DPH“
    address: '',         // sídlo / místo podnikání
    register: '',        // zápis v rejstříku (např. „vedená u Městského soudu v Praze, sp. zn. C 12345“) nebo „zapsán v živnostenském rejstříku“
    email: '',           // kontaktní e-mail pro zákazníky a pro oznamování incidentů
    phone: '',           // telefon (nepovinné)
    dataProtectionEmail: '', // e-mail pro žádosti o ochranu osobních údajů (může být stejný jako e-mail výše)
    hosting: '',         // kde aplikace běží (např. „Vercel Inc.“) a v jakém regionu
    dbRegion: '',        // region databáze Supabase (např. „Frankfurt, EU“)
    mailProvider: '',    // poskytovatel e-mailů (např. „Resend“), až bude zapojen
    paymentProvider: '', // platební brána (např. „Stripe“), až bude zapojena
    effectiveFrom: '',   // datum účinnosti znění podmínek (např. „1. 12. 2026“)
};

export type ProviderKey = keyof typeof PROVIDER;

// Verze znění; uloží se spolu se souhlasem při registraci. Při každé změně podmínek ji zvyšte.
export const TERMS_VERSION = '2026-2';

// Jak dlouho po skončení přístupu se data uchovají (měsíce), než se smažou
export const RETENTION_MONTHS = 12;
// Zkušební doba (dny)
export const TRIAL_DAYS = 14;

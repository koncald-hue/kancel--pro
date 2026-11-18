# Bezpečnost a architektura Kanceláře (podklad pro audit)

Slouží správci IT kanceláře, auditorovi a nezávislému testerovi. Popisuje, co a kde je chráněno, kdo čemu věří a co nechráníme. Údaje, které jsem nemohl ověřit z kódu, jsou označené **[DOPLNIT]**.

## Hranice důvěry

| Prvek | Důvěřujeme mu | Co vidí |
|---|---|---|
| Prohlížeč advokáta | ano (drží hlavní klíč v paměti stránky) | vše, k čemu advokát má právo |
| Prohlížeč klienta (odkaz) | omezeně (přístup jen k jedné věci přes token) | jen věc daného odkazu |
| Aplikační server (Next.js) | ano pro autorizaci API, ne pro čtení šifrovaných dat | otevřená data jen pro dobu požadavku; šifrovaná data vidí jako šifru |
| Databáze Supabase | ano, jako správce dat | otevřená data (věci, klienti, faktury); šifrovaná data jako šifru |
| Poskytovatelé třetí strany (Brevo, OpenAI, Google, Fio) | jen volitelně a jen pro vybraná data | viz `HOSTING-A-ZPRACOVATELE.md` |

## Co je end-to-end šifrované

AES-256-GCM v prohlížeči (`lib/e2ee.ts`). Hlavní klíč advokáta je náhodný, zabalený klíčem odvozeným z šifrovacího hesla (PBKDF2, 600 000 iterací) a záložně záchranným kódem. Klíč klientského odkazu (věc) je zabalený hlavním klíčem; klient ho dostane v části adresy za `#`, která se neodesílá. Šifrované jsou: zprávy a soubory klientského kanálu, přihlašovací údaje ke schránce, datové schránce a bance. **Není** šifrováno end-to-end: věci, lhůty, klienti, kontakty, faktury, výkazy, úschovy ani obyčejné soubory ve spisu. Ty chrání přístupová práva v databázi.

## Přístupová práva

- Row Level Security na všech tabulkách. Vlastník vidí svá data; věc sdílená kolegovi je viditelná přes `can_read_case` / `can_write_case`.
- Restriktivní politika `mfa_guard` vynucuje druhý faktor (aal2) u uživatelů, kteří ho zapnuli. Chybí-li, databáze data nevydá.
- Funkce s `security definer` (např. `team_hours`, `conflict_firm_check`, `escrow_balance`) kontrolují `auth.uid()`, MFA a oprávnění a vrací jen nezbytné. Přehled hodin kolegů a střet zájmů v kanceláři nikdy nevrací obsah ani jména kolegů.
- Evidence úschov: tabulky pouze pro vlastníka, pohyby append-only (trigger zakazuje UPDATE/DELETE), výdej nad zůstatek a zápis do uzavřené úschovy odmítne databáze.
- Auditní záznam otevření a změn věcí (`audit`), omezený počet pokusů (`api_rate_limits`).

## Aplikační vrstva

- Content-Security-Policy omezuje skripty a rámce na vlastní doménu. Výjimka: cesty `/doplnek/*` (doplňky pro Word a Outlook) smí načíst Office.js z `appsforoffice.microsoft.com` a být vložené do rámce domén Microsoftu; zbytek aplikace je nevložitelný (`frame-ancestors 'none'`).
- AI (`/api/case-ai`): vyžaduje souhlas uložený v databázi, text se před odesláním zbaví identifikátorů (`lib/redact.ts`), kontrola střetu zájmů AI nepoužívá.
- Poštovní a datové schránky: přihlašovací údaje procházejí serverem jen jeden požadavek, neukládají se v čitelné podobě.

## Testy

- Jednotkové testy: `npm test` (vitest, přes 400 testů včetně kryptografie, oprávnění, střetu zájmů, úschov).
- Živé testy proti databázi (`scripts/*.cjs`, proměnné prostředí, nikdy ne na ostrém projektu bez zkoušky): `pentest.cjs` (zneužití oprávnění a vstupů), `share-test.cjs`, `mfa-test.cjs`, `features-test.cjs`, `hlidac-test.cjs`, `mgmt-test.cjs`, `novinky-test.cjs`, `uschovy-test.cjs`.
- Nejde o nezávislý audit ani certifikaci.

## Co zatím chybí

- Nezávislý penetrační test (zadání: `PENTEST-ZADANI.md`).
- Zkouška obnovy ze zálohy na ostrém prostředí (`ZALOHY-A-OBNOVA.md`).
- Ověřený region a uzavřené smlouvy se subdodavateli **[DOPLNIT]**.
- Povinnosti advokáta (mlčenlivost, vedení úschov) posuzuje advokát podle předpisů ČAK. Software je pomůcka.

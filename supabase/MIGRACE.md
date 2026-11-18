# Databáze Kanceláře: jak se zakládá a mění

Aplikace nemá automatické nasazování databáze. SQL se spouští ručně v Supabase (SQL Editor → New query → vložit → Run).
Nic z tohoto repozitáře samo nemění produkční databázi.

## Pravidla pro každou změnu

1. Každý skript musí jít spustit opakovaně (`create … if not exists`, `add column if not exists`, `create or replace`, `drop … if exists` před `create policy/trigger`).
2. Skript nesmí mazat ani přepisovat existující data. Nové sloupce mají výchozí hodnotu nebo povolují `null`.
3. Každou změnu nejdřív spusťte na **odděleném testovacím projektu Supabase**, teprve potom na ostrém.
4. Před spuštěním na ostrém projektu si v Supabase udělejte zálohu (Database → Backups) nebo export.

## Nové změny: složka `supabase/migrations/`

Od 17. 11. 2026 patří každá nová změna do samostatného souboru ve složce `supabase/migrations/` s názvem
`RRRRMMDD_NN_popis.sql` (např. `20261117_01_ukoly-a-potvrzeni-lhut.sql`). Soubory se spouštějí **podle názvu, vzestupně**.
Každý soubor na konci zapíše svůj název do tabulky `public.schema_migrations`. Tabulka je dostupná jen serveru (service role).

Co je spuštěné a co chybí, ukáže skript, který databázi jen čte:

```bash
node scripts/migrations-status.mjs
```

Potřebuje v `.env.local` hodnoty `NEXT_PUBLIC_SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY`.

| Soubor | Co přidává |
|---|---|
| `20261117_01_ukoly-a-potvrzeni-lhut.sql` | Evidence migrací; u lhůt druh (lhůta/úkol), odpovědná osoba, potvrzení data advokátem, vazba na vypočtenou lhůtu a na poptávku. Kontroly v databázi (trigger). Existující lhůty zůstávají nepotvrzené. |
| `20261117_02_portal-kod-z-emailu.sql` | Volitelný druhý faktor klientského odkazu (kód z e-mailu zadaného advokátem), tabulka relací klientů jen s otisky kódů. Existující odkazy se nemění. |
| `20261117_03_prava-funkci.sql` | Nepřihlášený návštěvník (anon) nesmí spouštět funkce pro přihlášené; `has_lawyer_access` neprozradí předplatné cizího uživatele. |
| `20261117_04_klientske-zaznamy-jen-vlastnik.sql` | Klientský odkaz, požadavky, zprávy, podpisy a identifikace smí ke věci vytvořit jen její vlastník (kolega u sdílené věci ne); příznak „viditelné klientovi“ mění jen vlastník. |
| `20261118_05_druhy-faktor-v-databazi.sql` | Dvoufázové přihlášení (TOTP) vynucené v databázi: u účtu se zapnutým druhým faktorem vydá databáze data jen v relaci aal2. Kdo faktor nemá, nepozná změnu. |
| `20261118_06_auditni-zaznam.sql` | Auditní záznam (kdo kdy co ve věci otevřel nebo změnil), jen pro přidávání, čtení přes funkci `audit_list`. |
| `20261118_07_vzhled-klientske-stranky.sql` | Barva (z pevné nabídky) a uvítání na klientské stránce. |
| `20261118_08_ai-souhlas.sql` | Souhlas advokáta s asistentem AI (čas souhlasu, odvolání). |
| `20261118_09_verze-a-obsah-souboru.sql` | Verze souborů a vyhledávání v textu nešifrovaných souborů (txt, csv, md, html, docx). |
| `20261118_10_hlidac-a-vykazy.sql` | Hlídání řízení v katastru (sloupce `watch*` u uložených nemovitostí, nový druh události radaru), úkon „splnění úkolu“ pro návrh výkazu. |
| `20261118_11_prehled-a-sablony.sql` | Dobrovolné sdílení hodin vedoucímu kanceláře (`time_sharing`, funkce `team_hours`) a šablony úkolů pro nové věci (`case_templates`). |

## Starší skripty (před zavedením složky migrations)

Pro nový prázdný projekt v tomto pořadí. Pořadí vychází ze závislostí uvedených v záhlaví jednotlivých souborů.
U existující databáze spouštějte jen to, co ještě neběželo. Všechny jdou spustit opakovaně.

1. Základ: `00-zaklad.sql`, `cases.sql`, `case-files.sql`, `case-meta.sql`, `lawyer.sql`, `defense.sql`
2. Klienti a ověření: `client-portal.sql`, `client-identity.sql`, `verification-e2ee.sql`, `verification-billing.sql`, `tiers.sql`, `pul-rocni-plan.sql`
3. Kanceláře a role: `firms.sql`, `pozvanka-info.sql`, `sdileni.sql`, `jmena.sql`, `role.sql`, `testovaci-balicek.sql`, `zruseni-a-zamek.sql`, `sdilene-veci.sql`
4. Podpisy a profil: `podpisy-a-aml.sql`, `podpisy-email.sql`, `podpisy-kod-od-advokata.sql`, `profil.sql`, `profil-foto.sql`
5. Chat: `chat.sql`, `chat-vyzva.sql`
6. Peníze: `fakturace.sql`, `platby.sql`, `propojeni.sql`, `platby-banka.sql`
7. Poptávky: `poptavky-propojeni.sql`, `poptavky-prilohy.sql`
8. Datové schránky: `datove-schranky.sql`, `datove-zpravy-ve-veci.sql`, `lhuty-z-datovek.sql`
9. Rejstříky a nástroje: `insolvence.sql`, `insolvence-klienti.sql`, `klienti-datum-narozeni.sql`, `katastr.sql`, `posta.sql`, `pravni-rese.sql`, `google-kalendar.sql`, `hledani.sql`, `import.sql`, `vzory.sql`, `stopa-prace.sql`, `radar.sql`, `kalendar-feed.sql`
10. Statistiky provozovatele: `admin-stats.sql`
11. Jako poslední ze starších: `security-hardening.sql` (atomické limity požadavků, ochrana vlastníka věci, OTP funkce jen pro server)
12. Pak všechny soubory ze složky `migrations/` podle názvu.

`_nove-dohromady.sql` je souhrn novějších změn (sdílení věcí, role, zámek) pro databáze, kde starší jednotlivé skripty neběžely. Na databázi, kde běžely všechny výše uvedené, ho spouštět není potřeba (neuškodí, je opakovatelný).

## Co se nesmí

- Spouštět skripty přímo na ostrém projektu bez vyzkoušení na testovacím.
- Měnit RLS politiky plošně bez ověření sdílení věcí v týmu (`can_read_case`, `can_write_case`).
- Ukládat do repozitáře skutečná data klientů nebo klíče (`.env.local` je v `.gitignore`).

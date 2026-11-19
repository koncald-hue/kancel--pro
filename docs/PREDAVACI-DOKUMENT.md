# Předávací dokument: Kancelář a Právo srozumitelně

Stav k 19. 11. 2026. Popisuje, co obě aplikace umějí, jak se nasazují, co je potřeba nastavit a co zbývá před spuštěním.
Podrobnosti jsou v dalších souborech složky `docs/` (odkazy u jednotlivých částí).

## 1. Dvě aplikace

| | **Kancelář** | **Právo srozumitelně** |
|---|---|---|
| Repozitář | `pravo-office` | `pravo-web` |
| Pro koho | advokáti a advokátní kanceláře (placené předplatné) | veřejnost a studenti (zdarma + e-shop se vzory) |
| Technologie | Next.js 16 (App Router, Cache Components), Tailwind, Supabase | stejné |
| Databáze | vlastní projekt Supabase | vlastní projekt Supabase (oddělený) |
| Správa | `/admin` (jen tým provozovatele) | `/sprava` (jen tým) |

Propojení: web odkazuje na Kancelář přes `NEXT_PUBLIC_OFFICE_URL`, Kancelář na web přes `NEXT_PUBLIC_PUBLIC_SITE_URL`. Databáze jsou úplně oddělené.

## 2. Co Kancelář umí (přehled)

- **Věci (spisy):** soubory se složkami a verzemi, OCR skenů, hledání v textu dokumentů, chronologie, kontakty, lhůty a úkoly (zákonné lhůty s výpočtem, potvrzení data advokátem), kontrola věci před podáním, archiv a skartace s protokolem.
- **Klienti:** karta klienta (věci, čas, pohledávky), kontakt jedním klepnutím (e-mail z aplikace, volání, SMS, WhatsApp), kontrola střetu zájmů (i napříč kanceláří, bez prozrazení údajů kolegů), import z Excelu.
- **Klientská stránka:** soukromý odkaz s end-to-end šifrováním, zprávy, nahrávání podkladů, podpisy dokumentů (SMS/e-mail kód, Bank iD), AML identifikace, týdenní přehled pro klienta (jen počty).
- **Pošta:** e-mailová schránka (IMAP/SMTP) s návrhem věci (pravidla + volitelně AI), uložení e-mailu s přílohami do věci, hromadný e-mail klientům, datová schránka (ISDS) včetně lhůt z doručených rozhodnutí, **podací deník** s čísly jednacími a doručenkami, doplňky pro Word a Outlook.
- **Kalendář a úkoly:** kalendář (měsíc/seznam) s lhůtami, úkoly a událostmi, úkoly mezi kolegy, odběr do telefonu (iCal) a synchronizace s Google Kalendářem.
- **Peníze:** výkazy práce, fakturace (zálohové faktury, opakovaná fakturace, odečet záloh), platby a párování z banky (Fio, CSV, camt), upomínky, úschovy (kniha pohybů), rentabilita, export pro účetní (CSV, ISDOC, Pohoda XML, Money S3 XML).
- **Tým:** kancelář s balíčkem míst, sdílení věcí, šifrovaný chat, zastupování při nepřítomnosti, přehled pro vedení (hodiny jen s dobrovolným sdílením), společné fakturační údaje kanceláře.
- **Nástroje:** Hlídač (katastr, rejstříky, insolvence), katastr, rejstříky, insolvenční rejstřík, InfoSoud, platební rozkazy (EPR), knihovna vzorů, kalkulačky, AI asistent ve věci (jen se souhlasem a po zakrytí identifikátorů).
- **Správa provozovatele (`/admin`):** uživatelé a předplatné, balíčky kanceláří, hlídání insolvence, **automatické účetnictví** (faktura při zaplacení, dobropisy, výdaje, kniha faktur, peněžní deník), poznámky k uživatelům, záznam úkonů správce, statistiky, judikatura.

Právo srozumitelně: průvodce situací (AI), chytré hledání, přestupky a trestné činy, kalkulačky, články, vzory a e-shop (s AI vyplňováním), moje případy (zjednodušený spis), studentská poradna a materiály, nabídky práce, správa s účetnictvím.

## 3. Nasazení

1. **Hosting:** doporučeně Vercel (každá aplikace jako samostatný projekt). Region co nejblíž databázi (EU). Viz `docs/HOSTING-A-ZPRACOVATELE.md`.
2. **Proměnné prostředí** nastavit podle tabulky v části 4. Nikdy je nedávat do repozitáře (`.env.local` je v `.gitignore`).
3. **Databáze:** postup v `supabase/MIGRACE.md`. Nejdřív základní SQL soubory ze složky `supabase/` (pořadí je v MIGRACE.md), potom vše ze `supabase/migrations/` podle názvu. Kontrola: `node scripts/migrations-status.mjs`.
   - **Vkládání SQL do Supabase:** kopírujte ze souboru v editoru, ne přes terminál bez nastaveného kódování (jinak se poškodí diakritika ve funkcích; viz migrace 22).
4. **Plánovač** (`docs/PLANOVAC.md`): `/api/cron/isir` denně, `/api/cron/digest` v pondělí ráno, s `CRON_SECRET`.
5. **Doména a e-mail:** vlastní doména, ověřený odesílatel u Brevo (nebo Resend), SPF/DKIM/DMARC. Vypnout blokaci IP v Brevu nebo povolit IP hostingu.
6. **Zálohy:** `docs/ZALOHY-A-OBNOVA.md` (skripty `scripts/backup-*`). Zkouška obnovy před spuštěním.
7. **Build:** `npm run build` (u Kanceláře se před buildem kopírují soubory pro OCR do `public/ocr`).

## 4. Proměnné prostředí

### Kancelář (`pravo-office`)
| Proměnná | K čemu | Povinná |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | databáze | ano |
| `SUPABASE_SERVICE_ROLE_KEY` | serverové úlohy (portál klienta, cron, souhrny, limity) | ano |
| `NEXT_PUBLIC_SITE_URL` | veřejná HTTPS adresa (odkazy v e-mailech, Bank iD, iCal); v produkci povinná | ano |
| `NEXT_PUBLIC_PUBLIC_SITE_URL` | odkaz na Právo srozumitelně | ne |
| `MAIL_FROM` + `BREVO_API_KEY` (nebo `RESEND_API_KEY`) | odesílání e-mailů (kódy, upozornění, souhrny) | ano |
| `CRON_SECRET` | ochrana plánovaných úloh | ano |
| `SIGN_SEAL_SECRET` | pečeť dokladů o podpisu | ano |
| `OPENAI_API_KEY` | AI asistent, návrh věci k e-mailu | ne |
| `COMGATE_MERCHANT`, `COMGATE_SECRET`, `COMGATE_TEST` | platební brána Comgate (ID obchodu, heslo API, `true` = testovací platby) | před spuštěním |
| `PAYMENT_WEBHOOK_SECRET`, `NEXT_PUBLIC_LAWYER_PAYMENT_URL` | záložní vlastní brána přes podepsaný webhook (nepovinné) | ne |
| `TWILIO_*` | SMS kódy k podpisu (jinak e-mail) | ne |
| `BANKID_*`, `MOJEID_*`, `IDENTITY_PROVIDER` | ověření totožnosti klienta | ne |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Kalendář | ne |
| `CUZK_API_KEY` | katastr (rozšířené dotazy) | ne |
| `SIGN_DEV_OTP` | jen vývoj (kód v odpovědi); v produkci nenastavovat | ne |

### Právo srozumitelně (`pravo-web`)
| Proměnná | K čemu | Povinná |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | databáze | ano |
| `SUPABASE_SERVICE_ROLE_KEY` | nabídky práce, denní strop AI | ano |
| `NEXT_PUBLIC_SITE_URL` | veřejná adresa (SEO, odkazy) | ano |
| `NEXT_PUBLIC_OFFICE_URL` | odkaz na Kancelář | ano |
| `OPENAI_API_KEY`, `OPENAI_DOCUMENT_MODEL` | AI funkce | ano pro AI |
| `PUBLIC_AI_SALT` | sůl pro otisk IP v denním stropu AI | doporučeno |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `GOOGLE_SITE_VERIFICATION` | analytika (jen se souhlasem), ověření webu | ne |

## 5. Databáze webu (Právo srozumitelně)

Soubory ve složce `pravo-web/supabase/` se spouštějí ručně v Supabase webu. Nově: `ucetnictvi-provozovatele.sql` (účetnictví a záznam správce) a `ai-verejne-limity.sql` (denní strop veřejných AI funkcí; **bez něj se v produkci veřejné AI funkce vypnou**, protože bez stropu by šly zneužít), `nabidky-prace.sql`.

## 6. Testy a kontroly

- `npm test` (Kancelář přes 490 testů, web přes 60), `npm run typecheck`, `npm run lint`.
- Živé testy proti databázi (`scripts/*.cjs`, údaje v proměnných prostředí; nikdy na ostrém projektu bez zkoušky): `pentest.cjs`, `share-test.cjs`, `mfa-test.cjs`, `denik-test.cjs`, `kalendar-test.cjs`, `ucetnictvi-test.cjs`, `uschovy-test.cjs`, `novinky-test.cjs` a další. Popis vždy na začátku souboru.
- Bezpečnost a architektura: `docs/BEZPECNOST-A-ARCHITEKTURA.md`, zadání nezávislého testu: `docs/PENTEST-ZADANI.md`.

## 7. Co zbývá před spuštěním

1. Comgate: založit obchod, v klientském portálu nastavit adresu oznámení `https://<doména>/api/payments/comgate/notify`, adresy návratu (zaplaceno/zrušeno/čeká) na `https://<doména>/kancelar/nastaveni`, povolit IP serveru pro API; vyzkoušet v testovacím režimu (`COMGATE_TEST=true`) a ověřit podmínky opakovaných plateb.
2. Doména, odesílání e-mailů (Brevo: ověřený odesílatel, IP), hosting a plánovač.
3. Obchodní podmínky, zpracovatelská smlouva a ochrana osobních údajů prověřené právníkem; posouzení úschov a navrhovaných lhůt (ČAK).
4. Výměna všech klíčů a hesel použitých při vývoji (Supabase service key, Brevo, Google, testovací hesla).
5. Nezávislý penetrační test.
6. Kontrola účetních výstupů účetní (faktury provozovatele, import do Pohody/Money S3).
7. Pilot se 3–5 advokáty.

## 8. Známá omezení

- Doplňky Word a Outlook jsou otestované jen se simulovaným Office, ne v pravém Wordu/Outlooku.
- Formát Money S3 není ověřený proti schématu výrobce (Pohoda ano).
- InfoSoud nemá veřejné rozhraní: Kancelář jen připraví údaje a připomíná kontrolu.
- Limity počtu požadavků počítají s hostingem, který nastavuje skutečnou IP (`x-real-ip`, Vercel).
- Navržené lhůty, kontrola střetu zájmů a délka archivace jsou pomůcky; rozhoduje advokát.

# Kancelář Pro

Samostatná aplikace pro advokáty a právníky (spisy, lhůty, klienti, výkazy práce, klientský portál s end-to-end šifrováním, ověřování advokátů a předplatné). Vznikla oddělením od veřejného webu „Právo srozumitelně“; s ním je propojená jen odkazy.

## Spuštění
1. Založ nový projekt Supabase (oddělený od veřejného webu).
2. Zkopíruj `.env.example` do `.env.local` a vyplň hodnoty. V produkci nastav `NEXT_PUBLIC_SITE_URL` na kanonickou HTTPS adresu aplikace; Bank iD používá tuto adresu pro bezpečný návrat z ověření.
3. Databázi založ podle [`supabase/MIGRACE.md`](supabase/MIGRACE.md): starší skripty v uvedeném pořadí, jako poslední z nich `security-hardening.sql` (atomické limity požadavků, ochrana vlastníka věci, OTP jen pro server; bez něj aplikace v produkci omezené API požadavky záměrně odmítne), potom soubory ze složky `supabase/migrations/` podle názvu.
4. Všechno nejdřív vyzkoušej na odděleném testovacím Supabase projektu. Stav migrací ukáže `node scripts/migrations-status.mjs` (databázi jen čte).
5. Zaregistruj se v aplikaci a pak sebe přidej do týmu: `insert into public.staff (user_id) select id from auth.users where email = 'tvuj@email.cz';`
6. `npm install`, `npm run dev`.

## Zatím chybí
- Platební brána (webhook je připravený, `PAYMENT_WEBHOOK_SECRET` a `NEXT_PUBLIC_LAWYER_PAYMENT_URL` nejsou nastavené).
- Doména a ostrá adresa odesílatele e-mailů (`MAIL_FROM` + Brevo/Resend); bez nich nefungují kódy z e-mailu pro klienty.
- Obchodní podmínky a zpracovatelská smlouva zkontrolované advokátem.

## Bezpečnost (stav k 17. 11. 2026)
- Hlavičky: CSP (bez nonce, protože stránky používají předgenerované části; skripty jen z vlastní domény), HSTS, X-Frame-Options, COOP/CORP, `no-store` pro API. Viz `next.config.ts`.
- Klientský odkaz: samotný odkaz dává přístup ke zpřístupněným údajům věci. Advokát může u odkazu zapnout druhý faktor (kód z e-mailu, relace v HttpOnly cookie na 12 h). Vyplněné jméno a souhlas klienta totožnost neověřují.
- End-to-end šifrování se týká zpráv a souborů klientského kanálu (když je zapnuté). Ostatní údaje (věci, lhůty, kontakty, faktury) jsou v databázi chráněné oprávněními (RLS), ne end-to-end šifrováním.
- Šifrovací klíč advokáta je jen v paměti stránky; zamyká se obnovením stránky, odhlášením a po 30 minutách nečinnosti.
- `picomatch` (ReDoS GHSA-fc5q-39xc-vjpf, bez opravené verze od autora): vývojové nástroje používají opravené kopie ze složky `vendor/`, regresní test `scripts/security/picomatch-redos.test.ts`.
- Kontroly jsou statická revize kódu a lokální testy, ne certifikace ani penetrační test třetí strany.

## Katastr nemovitostí (ČÚZK)
Vyhledání parcely ve spisu a samostatně (záložka Katastr) používá **bezplatné API katastru nemovitostí ČÚZK**.
1. Zaregistrujte se na https://registrace.cuzk.gov.cz/Secured/ISKN/APIKN (fyzická osoba přes Identitu občana, právnická osoba účtem dálkového přístupu) a vygenerujte klíč.
2. Klíč vložte do `.env.local` jako `CUZK_API_KEY` (jen na serveru, podmínky ČÚZK zakazují jeho předání koncovému zařízení).
3. V Supabase spusťte `supabase/katastr.sql` (ukládání nemovitostí ke spisu).
4. Podmínky: https://api-kn.cuzk.gov.cz/PodminkyUzivani. API nevrací osobní údaje (vlastníky), údaje jsou informativní a počet volání je omezený pro celý klíč.

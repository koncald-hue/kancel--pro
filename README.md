# Kancelář

Samostatná aplikace pro advokáty a právníky (spisy, lhůty, klienti, výkazy práce, klientský portál s end-to-end šifrováním, ověřování advokátů a předplatné). Vznikla oddělením od veřejného webu „Právo srozumitelně“; s ním je propojená jen odkazy.

## Spuštění
1. Založ nový projekt Supabase (oddělený od veřejného webu).
2. Zkopíruj `.env.example` do `.env.local` a vyplň hodnoty.
3. V Supabase (SQL Editor) spusť postupně soubory ze složky `supabase/`:
   `00-zaklad.sql`, `cases.sql`, `case-files.sql`, `case-meta.sql`, `lawyer.sql`, `defense.sql`, `client-portal.sql`, `client-identity.sql`, `verification-e2ee.sql`, `verification-billing.sql`, `tiers.sql`.
4. Zaregistruj se v aplikaci a pak sebe přidej do týmu: `insert into public.staff (user_id) select id from auth.users where email = 'tvuj@email.cz';`
5. `npm install`, `npm run dev`.

## Zatím chybí
- Platební brána (webhook je připravený, `PAYMENT_WEBHOOK_SECRET` a `NEXT_PUBLIC_LAWYER_PAYMENT_URL` nejsou nastavené).
- Vlastní knihovna šablon a judikatury (záložka Knihovna je zatím prázdná).
- Doména, odesílání e-mailů (SMTP), obchodní podmínky.

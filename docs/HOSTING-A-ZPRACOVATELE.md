# Popis hostingu a zpracovatelů (návrh)

Dokument slouží jako příloha zpracovatelské smlouvy. Údaje označené **[DOPLNIT]** musí provozovatel ověřit a doplnit, nejsou odvozené z kódu. Neuvádím tu nic, co jsem nemohl ověřit.

## Architektura

- **Aplikace** (Next.js, kód v tomto repozitáři) běží na hostingu: **[DOPLNIT poskytovatele a region]**. V době psaní není nasazená do produkce, vývoj běží lokálně.
- **Databáze, přihlašování a úložiště souborů:** Supabase (Postgres, Auth, Storage). Region projektu: **[DOPLNIT: Supabase → Settings → General → Region; pro EU např. Frankfurt (eu-central-1)]**. Pokud region není v EU, není možné tvrdit, že data zůstávají v EU.
- **Šifrování:** přenos TLS. Zprávy a soubory klientského kanálu mohou být end-to-end šifrované klíčem advokáta (server a provozovatel je nepřečtou), pokud advokát šifrování zapne. Ostatní údaje (věci, lhůty, kontakty, faktury) jsou v databázi chráněné oprávněními, **nejsou** end-to-end šifrované.
- **Přístup:** každý advokát vidí jen svá data a data věcí, které mu kolega výslovně sdílel (kontrola přímo v databázi). Volitelné dvoufázové přihlášení (TOTP), vynucené i v databázi. Auditní záznam otevření a změn ve věcech.

## Další zpracovatelé (subdodavatelé)

| Služba | Účel | Jaká data | Sídlo / region | Stav |
|---|---|---|---|---|
| Supabase | databáze, přihlášení, soubory | všechna data aplikace | **[DOPLNIT region]** | používá se |
| Hosting aplikace | běh aplikace | data prochází při zpracování požadavků | **[DOPLNIT]** | nerozhodnuto |
| Brevo (Sendinblue) | odesílání kódů a e-mailů | e-mail příjemce, text kódu | Francie (EU) podle poskytovatele, **ověřit ve smlouvě** | používá se |
| OpenAI | volitelná AI funkce (shrnutí, návrh odpovědi) | jen text, který advokát výslovně odešle, po zakrytí identifikátorů | USA, pokud není zapnutá evropská rezidence dat **[DOPLNIT]** | volitelné, vypnuté bez souhlasu |
| ČÚZK, ARES, ISIR, Sbírka zákonů | veřejné zdroje | dotazy (IČO, parcela), žádná data klientů | ČR | používá se |
| Fio banka | načtení plateb | token advokáta, který se neukládá | ČR | volitelné |
| Google Kalendář | synchronizace lhůt | názvy a data lhůt | **[DOPLNIT]** | volitelné, vypnuté bez souhlasu |

Datové schránky a e-mailové schránky advokáta: přihlašovací údaje jsou uložené šifrované hlavním klíčem advokáta a při použití procházejí serverem jen na dobu jednoho požadavku. Neukládají se v čitelné podobě ani se nelogují.

## Co zatím chybí (poctivě)

- Nezávislý penetrační test třetí stranou (provedl jsem rozsáhlé vlastní testy, viz `scripts/pentest.cjs`, nejsou to certifikace).
- Smlouvy se subdodavateli (DPA Supabase, Brevo, hosting) **[DOPLNIT odkazy a data uzavření]**.
- Zkouška obnovy ze zálohy na ostrém prostředí (viz `docs/ZALOHY-A-OBNOVA.md`).
- Certifikace (ISO 27001 apod.) provozovatel nemá.

# Zálohy a obnova

Co v tomto dokumentu stojí, je popis postupu a nástrojů. **Obnovu na vlastním ostrém projektu jsem nezkoušel a nelze ji z tohoto repozitáře ověřit**: spoléhá na zálohy Supabase, které závisejí na zvoleném tarifu. Skutečné ověření obnovy musí provést provozovatel podle části „Pravidelná zkouška“.

## Co se zálohuje a kde

| Vrstva | Zálohuje | Jak dlouho | Stav |
|---|---|---|---|
| Databáze (Postgres) | Supabase: denní zálohy; obnovu k libovolnému okamžiku (PITR) nabízí jako doplněk u placených tarifů | podle tarifu (Free tarif zálohy nenabízí) | **ověřte v Supabase → Database → Backups, jaký tarif máte a zda je PITR zapnuté** |
| Soubory (úložiště) | Supabase Storage nemá vlastní zálohu obsahu | – | zálohujte skriptem s `--files` |
| Vlastní logická záloha | `scripts/backup-export.cjs` (šifrovaná, s kontrolními součty) | podle vás | hotovo, vyzkoušeno na skutečných datech |
| Zdrojový kód a migrace | Git | trvale | hotovo |
| Klíče a tajemství | Správce tajemství hostingu a `.env.local` mimo repozitář | – | uložte si je odděleně od záloh |

**Šifrovaná data klientů (end-to-end):** záloha obsahuje zašifrované zprávy a soubory, které bez šifrovacího hesla advokáta nikdo nepřečte, ani provozovatel. Ztracené šifrovací heslo znamená trvale nečitelný obsah. Záloha to neřeší.

## Cíle

- Nejvýše 24 hodin ztráty dat (RPO) s denními zálohami, minuty s PITR.
- Obnova v řádu hodin (RTO), pokud je k dispozici záloha a přístup do Supabase.

## Vlastní záloha (doporučeno aspoň týdně a před každou migrací)

```bash
BACKUP_PASSPHRASE='<dlouhé heslo uložené jinde>' node scripts/backup-export.cjs --files
BACKUP_PASSPHRASE='<totéž heslo>' node scripts/backup-verify.cjs backups/<složka> --live
```

Export čte data klíčem service role a nic nemění. Soubory v `backups/` jsou šifrované (AES-256-GCM, klíč ze hesla přes scrypt). Složka je v `.gitignore`. Uložte ji mimo pracovní počítač (šifrovaný disk nebo jiné úložiště) a heslo odděleně.

`backup-verify` kontroluje kontrolní součty (poškozený soubor se pozná), dešifrování (špatné heslo selže) a počty řádků proti manifestu i živé databázi. Obojí je vyzkoušeno.

## Pravidelná zkouška obnovy (čtvrtletně)

Záloha, kterou jste nikdy neobnovili, není záloha.

1. V Supabase založte **oddělený testovací projekt** (ne ostrý).
2. Spusťte v něm všechny SQL podle `supabase/MIGRACE.md`.
3. Obnovte do něj zálohu:
   ```bash
   BACKUP_PASSPHRASE='…' TARGET_URL='https://<testovaci>.supabase.co' TARGET_SERVICE_KEY='<service role testovacího projektu>' \
   node scripts/backup-restore-test.cjs backups/<složka>
   ```
   Skript odmítne cíl, který je shodný s ostrým projektem. Uživatelské účty vytvoří se stejným id a náhodným heslem (hesla Supabase nevydává).
4. Přihlaste se do testovacího projektu, projděte věc, soubor a fakturu. Výsledek zapište (datum, kdo, co chybělo).
5. Testovací projekt smažte, obsahuje kopii dat klientů.

Skript `backup-restore-test.cjs` je napsaný, ale **nebyl spuštěn**, protože testovací projekt neexistuje. Pořadí tabulek ve skriptu se může při první zkoušce muset upravit.

## Obnova při havárii

1. Zjistěte rozsah (smazaná data, poškozená migrace, výpadek poskytovatele).
2. Zastavte zápisy (odstavte aplikaci nebo ji přepněte do režimu jen pro čtení).
3. Databáze: Supabase → Database → Backups → obnovit k času před incidentem (PITR) nebo z denní zálohy. Pokud to nejde, použijte vlastní zálohu a `backup-restore-test.cjs` jako předlohu pro obnovu do nového projektu.
4. Soubory: nahrajte ze zálohy s `--files`.
5. Spusťte `node scripts/migrations-status.mjs`, ověřte stav migrací.
6. Ověřte přihlášení, věc, klientskou stránku a podpis. Informujte dotčené advokáty. Pokud došlo k úniku osobních údajů, platí postup v zpracovatelské smlouvě (oznámení správci bez zbytečného odkladu).
7. Napište zprávu o incidentu.

## Ztráta druhého faktoru

Pokud advokát ztratí telefon bez záložního zařízení: provozovatel po ověření totožnosti jinou cestou odebere faktor v Supabase (Authentication → Users → uživatel → Factors). Do té doby se uživatel do dat nedostane, což je záměr.

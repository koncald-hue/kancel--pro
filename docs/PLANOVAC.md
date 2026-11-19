# Pravidelné úlohy (plánovač hostingu)

Každou úlohu volá plánovač hostingu metodou GET s hlavičkou `Authorization: Bearer <CRON_SECRET>` (proměnná prostředí `CRON_SECRET`).

| Adresa | Kdy | Co dělá |
|---|---|---|
| `/api/cron/isir` | denně ráno | kontrola hlídaných osob v insolvenčním rejstříku |
| `/api/cron/digest` | jednou týdně (pondělí 7:00) | týdenní souhrn e-mailem advokátům, kteří ho zapnuli, a klientům u věcí, kde ho advokát zapnul (klient dostane jen počty, žádný obsah ani odkaz) |

V repozitáři je hotový soubor `vercel.json` s oběma úlohami (časy jsou v UTC: 06:00 UTC je v Praze 7:00 v zimě a 8:00 v létě). Na Vercelu stačí v projektu nastavit `CRON_SECRET`; plán Hobby dovoluje úlohy nejvýše jednou denně, což oběma stačí. Obsah souboru:

```json
{ "crons": [ { "path": "/api/cron/isir", "schedule": "0 6 * * *" }, { "path": "/api/cron/digest", "schedule": "0 6 * * 1" } ] }
```

Vercel posílá `CRON_SECRET` sám, pokud je nastavený v proměnných projektu. E-maily vyžadují `BREVO_API_KEY` (nebo `RESEND_API_KEY`) a `MAIL_FROM`.

## Jak úlohu vyzkoušet ručně

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<doména>/api/cron/isir
```

Bez hlavičky nebo se špatným tajemstvím vrací úloha 401. Pokud nepoužíváte Vercel, stejné volání nastavte v plánovači hostingu (cron, GitHub Actions apod.).

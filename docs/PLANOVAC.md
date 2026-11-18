# Pravidelné úlohy (plánovač hostingu)

Každou úlohu volá plánovač hostingu metodou GET s hlavičkou `Authorization: Bearer <CRON_SECRET>` (proměnná prostředí `CRON_SECRET`).

| Adresa | Kdy | Co dělá |
|---|---|---|
| `/api/cron/isir` | denně ráno | kontrola hlídaných osob v insolvenčním rejstříku |
| `/api/cron/digest` | jednou týdně (pondělí 7:00) | týdenní souhrn e-mailem advokátům, kteří ho zapnuli, a klientům u věcí, kde ho advokát zapnul (klient dostane jen počty, žádný obsah ani odkaz) |

Na Vercelu například `vercel.json`:

```json
{ "crons": [ { "path": "/api/cron/isir", "schedule": "0 6 * * *" }, { "path": "/api/cron/digest", "schedule": "0 6 * * 1" } ] }
```

Vercel posílá `CRON_SECRET` sám, pokud je nastavený v proměnných projektu. E-maily vyžadují `BREVO_API_KEY` (nebo `RESEND_API_KEY`) a `MAIL_FROM`.

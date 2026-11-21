-- =====================================================================
-- BALÍČEK DOKUMENTŮ K JEDNOMU PODPISU A AUTOMATICKÉ PŘIPOMÍNKY PODPISŮ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné podpisy-a-aml.sql, podpisy-email.sql a podpisy-kod-od-advokata.sql.
--
-- package_id:      dokumenty se stejným package_id se podepisují jedním kódem (smlouva + plná moc + souhlas + …)
-- reminded_at:     kdy klientovi naposledy odešla připomínka
-- reminder_count:  kolik připomínek už odešlo (po 2. a po 5. dni od vytvoření žádosti)
-- expiry_notified: advokát byl upozorněn, že žádost vypršela nepodepsaná
-- =====================================================================
alter table public.signature_requests add column if not exists package_id uuid;
alter table public.signature_requests add column if not exists reminded_at timestamptz;
alter table public.signature_requests add column if not exists reminder_count integer not null default 0;
alter table public.signature_requests add column if not exists expiry_notified boolean not null default false;
create index if not exists signature_requests_package_idx on public.signature_requests (package_id) where package_id is not null;
create index if not exists signature_requests_open_idx on public.signature_requests (status, expires_at) where status = 'pending';

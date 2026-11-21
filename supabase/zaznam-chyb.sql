-- =====================================================================
-- ZÁZNAM CHYB APLIKACE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěný 00-zaklad.sql (funkce is_staff).
-- Chyby v prohlížeči uživatelů se ukládají přes server (uživatelé do tabulky sami nezapisují).
-- Čte a maže je jen tým ve Správě. Ukládá se zkrácený text chyby, adresa bez parametrů a typ prohlížeče,
-- žádné údaje o spisech ani e-mailové adresy.
-- =====================================================================
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'client' check (source in ('client', 'boundary')),
  message text not null default '' check (char_length(message) <= 500),
  stack text not null default '' check (char_length(stack) <= 2000),
  page text not null default '' check (char_length(page) <= 200),
  ua text not null default '' check (char_length(ua) <= 200),
  fingerprint text not null default '' check (char_length(fingerprint) <= 200)
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;

drop policy if exists "app_errors_staff_select" on public.app_errors;
create policy "app_errors_staff_select" on public.app_errors for select using (public.is_staff());
drop policy if exists "app_errors_staff_delete" on public.app_errors;
create policy "app_errors_staff_delete" on public.app_errors for delete using (public.is_staff());

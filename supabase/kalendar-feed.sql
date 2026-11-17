-- =====================================================================
-- KALENDÁŘ LHŮT DO TELEFONU (odkaz k odběru, iCal)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Advokát si vytvoří tajný odkaz, který přidá do Apple Kalendáře, Googlu nebo Outlooku. Kalendář se pak sám aktualizuje.
-- Kdo odkaz zná, vidí lhůty; proto je odkaz dlouhý náhodný a jde kdykoli zrušit nebo vyměnit.
-- =====================================================================
create table if not exists public.calendar_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique check (char_length(token) >= 32),
  include_titles boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
drop policy if exists "calendar_feeds_own" on public.calendar_feeds;
create policy "calendar_feeds_own" on public.calendar_feeds for all using (user_id = auth.uid()) with check (user_id = auth.uid());

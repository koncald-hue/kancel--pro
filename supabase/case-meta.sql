-- =====================================================================
-- ÚDAJE O VĚCI: klient, spisová značka a úřad/soud (hodí se zejména advokátům)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- =====================================================================
alter table public.cases add column if not exists client_name text not null default '';
alter table public.cases add column if not exists reference text not null default '';
alter table public.cases add column if not exists authority text not null default '';

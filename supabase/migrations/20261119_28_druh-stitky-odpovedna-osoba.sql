-- =====================================================================
-- 20261119_28  DRUH PŘÍPADU, ŠTÍTKY A ODPOVĚDNÁ OSOBA U VĚCI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- =====================================================================
alter table public.cases add column if not exists case_type text not null default '' check (char_length(case_type) <= 40);
alter table public.cases add column if not exists labels text[] not null default '{}' check (cardinality(labels) <= 12);
alter table public.cases add column if not exists responsible text not null default '' check (char_length(responsible) <= 120);

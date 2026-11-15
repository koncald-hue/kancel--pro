-- =====================================================================
-- OBRANA VE SPISU: strategie obrany a ověřená knihovna judikatury
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run (zvol "Run and enable RLS").
-- Nejdřív musí být spuštěné cases.sql a 00-zaklad.sql (kvůli is_staff()).
--
-- Knihovnu judikatury plní tým ručně a každé rozhodnutí musí ověřit v oficiální databázi soudu.
-- Obrana může citovat JEN rozhodnutí z této knihovny, nikdy ne ta, která si AI „pamatuje“.
-- =====================================================================

create table if not exists public.case_law (
  id uuid primary key default gen_random_uuid(),
  court text not null,
  ref text not null,                 -- spisová značka, např. 4 Tdo 123/2020
  ecli text not null default '',
  decided_on date,
  title text not null,
  holding text not null,             -- právní věta nebo stručný závěr vlastními slovy
  url text not null default '',      -- odkaz na rozhodnutí v oficiální databázi
  topics text[] not null default '{}',
  offense_ids text[] not null default '{}',
  deadline_ids text[] not null default '{}',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (court, ref)
);

alter table public.case_law enable row level security;

drop policy if exists "case_law_read_verified" on public.case_law;
create policy "case_law_read_verified" on public.case_law for select using (verified or public.is_staff());
drop policy if exists "case_law_staff_write" on public.case_law;
create policy "case_law_staff_write" on public.case_law for all using (public.is_staff()) with check (public.is_staff());
grant select on public.case_law to anon, authenticated;
grant insert, update, delete on public.case_law to authenticated;

-- Uložená strategie obrany u případu
alter table public.cases add column if not exists defense jsonb;
alter table public.cases add column if not exists defense_at timestamptz;

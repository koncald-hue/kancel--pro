-- =====================================================================
-- KATASTR NEMOVITOSTÍ: nemovitosti uložené ve spisu
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné cases.sql.
--
-- Do spisu se uloží snímek údajů o parcele z API katastru (informativní, k datu dotazu).
-- Každý uživatel vidí jen své záznamy.
-- =====================================================================

create table if not exists public.case_properties (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  snapshot jsonb not null,
  data_as_of text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists case_properties_case_idx on public.case_properties (case_id, created_at desc);

alter table public.case_properties enable row level security;
drop policy if exists "case_properties_own" on public.case_properties;
create policy "case_properties_own" on public.case_properties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.case_properties to authenticated;

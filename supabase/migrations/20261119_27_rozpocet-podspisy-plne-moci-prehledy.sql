-- =====================================================================
-- 20261119_27  ROZPOČET SPISU, PODSPISY, REGISTR PLNÝCH MOCÍ, ULOŽENÉ PŘEHLEDY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Rozpočet a nadřazená věc jsou nové sloupce u věci, plné moci a uložené přehledy jsou nové tabulky, každý vidí jen své.
-- =====================================================================
alter table public.cases add column if not exists budget_czk numeric check (budget_czk is null or budget_czk >= 0);
alter table public.cases add column if not exists budget_warn_pct integer not null default 80 check (budget_warn_pct between 1 and 100);
-- Podspis: věc patřící pod jinou věc (např. exekuce pod hlavním řízením). Smazání nadřazené věci podspisy neruší, jen je uvolní.
alter table public.cases add column if not exists parent_id uuid references public.cases(id) on delete set null;
create index if not exists cases_parent_idx on public.cases (parent_id) where parent_id is not null;

create table if not exists public.powers_of_attorney (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  grantor text not null check (char_length(grantor) between 1 and 200),
  grantee text not null default '' check (char_length(grantee) <= 200),
  kind text not null default 'special' check (kind in ('general', 'special', 'procedural')),
  valid_from date,
  valid_to date,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index if not exists powers_user_idx on public.powers_of_attorney (user_id, valid_to);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'cases' check (scope in ('cases')),
  name text not null check (char_length(name) between 1 and 60),
  filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists saved_views_user_idx on public.saved_views (user_id, scope);

do $$
declare t text;
begin
  foreach t in array array['powers_of_attorney', 'saved_views'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

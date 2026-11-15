-- =====================================================================
-- SLOŽKA PŘÍPADU (Moje případy)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Každý přihlášený uživatel vidí a mění jen své vlastní případy.
-- =====================================================================

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  situation text not null default '',
  summary text not null default '',
  urgency text not null default 'medium',
  -- [{ "text": "...", "done": false }]
  steps jsonb not null default '[]'::jsonb,
  deadline_ids text[] not null default '{}',
  offense_ids text[] not null default '{}',
  template_keys text[] not null default '{}',
  -- Datum události (např. doručení dokumentu), od kterého se počítají lhůty
  event_date date,
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_user_idx on public.cases (user_id, created_at desc);

alter table public.cases enable row level security;

drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own" on public.cases for select using (auth.uid() = user_id);
drop policy if exists "cases_insert_own" on public.cases;
create policy "cases_insert_own" on public.cases for insert with check (auth.uid() = user_id);
drop policy if exists "cases_update_own" on public.cases;
create policy "cases_update_own" on public.cases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "cases_delete_own" on public.cases;
create policy "cases_delete_own" on public.cases for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.cases to authenticated;

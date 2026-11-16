-- =====================================================================
-- LHŮTY Z DATOVÝCH ZPRÁV
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné zruseni-a-zamek.sql a datove-zpravy-ve-veci.sql.
--
-- 1) Lhůta uložená z datové zprávy si pamatuje, odkud je: zprávu, doslovný citát z poučení a jak byl konec spočítán.
-- 2) Evidence, které přijaté datové zprávy advokát zkontroloval kvůli lhůtám (aby žádná zpráva neunikla bez kontroly).
-- =====================================================================
alter table public.case_deadlines add column if not exists basis text not null default '' check (char_length(basis) <= 1500);
alter table public.case_deadlines add column if not exists quote text not null default '' check (char_length(quote) <= 1500);
alter table public.case_deadlines add column if not exists source_dm text check (source_dm is null or char_length(source_dm) <= 30);
alter table public.case_deadlines add column if not exists internal_date date;
create unique index if not exists case_deadlines_dm_unique on public.case_deadlines (case_id, source_dm, title, due_date) where source_dm is not null;

create table if not exists public.data_message_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dm_id text not null check (char_length(dm_id) between 1 and 30),
  checked_at timestamptz not null default now(),
  deadlines integer not null default 0,
  note text not null default '' check (char_length(note) <= 500),
  unique (user_id, dm_id)
);
alter table public.data_message_checks enable row level security;
drop policy if exists "dmc_select" on public.data_message_checks;
create policy "dmc_select" on public.data_message_checks for select using (user_id = auth.uid());
drop policy if exists "dmc_insert" on public.data_message_checks;
create policy "dmc_insert" on public.data_message_checks for insert with check (user_id = auth.uid());
drop policy if exists "dmc_update" on public.data_message_checks;
create policy "dmc_update" on public.data_message_checks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "dmc_delete" on public.data_message_checks;
create policy "dmc_delete" on public.data_message_checks for delete using (user_id = auth.uid());
drop trigger if exists lock_when_expired on public.data_message_checks;
create trigger lock_when_expired before insert or update or delete on public.data_message_checks for each row execute function public.block_when_locked();

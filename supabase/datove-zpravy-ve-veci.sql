-- =====================================================================
-- DATOVÉ ZPRÁVY VE VĚCI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné zruseni-a-zamek.sql a datove-schranky.sql.
-- Ke věci se ukládá záznam o datové zprávě (odesílatel, adresát, věc zprávy, doručení) a její přílohy (jako soubory věci).
-- Samotný obsah zprávy se v databázi nikdy neukládá, jen přílohy, které advokát výslovně uloží.
-- =====================================================================
create table if not exists public.case_data_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dm_id text not null check (char_length(dm_id) between 1 and 30),
  direction text not null check (direction in ('received', 'sent')),
  sender text not null default '',
  recipient text not null default '',
  annotation text not null default '',
  delivered_at timestamptz,
  status text not null default '',
  files_saved integer not null default 0,
  created_at timestamptz not null default now(),
  unique (case_id, dm_id)
);
create index if not exists case_data_messages_dm_idx on public.case_data_messages (user_id, dm_id);
alter table public.case_data_messages enable row level security;
drop policy if exists "cdm_select" on public.case_data_messages;
create policy "cdm_select" on public.case_data_messages for select using (user_id = auth.uid());
drop policy if exists "cdm_insert" on public.case_data_messages;
create policy "cdm_insert" on public.case_data_messages for insert with check (user_id = auth.uid() and exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
drop policy if exists "cdm_update" on public.case_data_messages;
create policy "cdm_update" on public.case_data_messages for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "cdm_delete" on public.case_data_messages;
create policy "cdm_delete" on public.case_data_messages for delete using (user_id = auth.uid());
drop trigger if exists lock_when_expired on public.case_data_messages;
create trigger lock_when_expired before insert or update or delete on public.case_data_messages for each row execute function public.block_when_locked();

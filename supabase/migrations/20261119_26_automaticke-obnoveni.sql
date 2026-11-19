-- =====================================================================
-- 20261119_26  AUTOMATICKÉ OBNOVOVÁNÍ PŘEDPLATNÉHO
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Souhlas s opakovanou platbou a odkaz na první platbu u Comgate (z něj se strhávají další období).
-- Uživatel řádek jen čte; zapisuje server (služební klíč) a zrušení jde přes API.
-- =====================================================================
create table if not exists public.lawyer_recurring (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('month', 'half', 'year')),
  init_trans text,
  active boolean not null default false,
  fails integer not null default 0,
  consent_at timestamptz not null default now(),
  cancelled_at timestamptz,
  last_notice_for date,
  updated_at timestamptz not null default now()
);
alter table public.lawyer_recurring enable row level security;
drop policy if exists "lawyer_recurring_own_read" on public.lawyer_recurring;
create policy "lawyer_recurring_own_read" on public.lawyer_recurring for select to authenticated using (auth.uid() = user_id);

alter table public.lawyer_orders add column if not exists recurring_kind text check (recurring_kind in ('init', 'renewal'));

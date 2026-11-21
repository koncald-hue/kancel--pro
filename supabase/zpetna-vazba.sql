-- =====================================================================
-- ZPĚTNÁ VAZBA OD UŽIVATELŮ (tlačítko „Nahlásit problém nebo nápad“)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěný 00-zaklad.sql (funkce is_staff).
-- Uživatel vidí jen své zprávy; tým ve Správě vidí všechny a označuje je jako vyřízené.
-- =====================================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  kind text not null check (kind in ('problem', 'napad', 'jine')),
  message text not null check (char_length(message) between 5 and 2000),
  page text not null default '' check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;

drop policy if exists "feedback_select" on public.feedback;
create policy "feedback_select" on public.feedback for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_insert" on public.feedback for insert with check (user_id = auth.uid() and status = 'new');
drop policy if exists "feedback_update_staff" on public.feedback;
create policy "feedback_update_staff" on public.feedback for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "feedback_delete_staff" on public.feedback;
create policy "feedback_delete_staff" on public.feedback for delete using (public.is_staff());

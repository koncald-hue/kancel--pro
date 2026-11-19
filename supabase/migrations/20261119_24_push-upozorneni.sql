-- =====================================================================
-- 20261119_24  PUSH UPOZORNĚNÍ NA LHŮTY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Každé zařízení, na kterém advokát upozornění zapnul, má jeden řádek. Server (plánovaná úloha) z nich ráno pošle krátké
-- upozornění „blíží se lhůty“. Řádky vidí a maže jen jejich vlastník; odesílá se služebním klíčem.
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now(),
  last_sent_on date
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

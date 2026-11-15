-- =====================================================================
-- ZÁKLAD: tým provozovatele (staff) a funkce is_staff()
-- Spusť JAKO PRVNÍ v novém projektu Supabase (SQL Editor -> New query -> Run).
-- Člena týmu (tebe) pak přidáš ručně až po své registraci v aplikaci:
--   insert into public.staff (user_id) select id from auth.users where email = 'tvuj@email.cz';
-- Nikoho nepřidávej automaticky: tým ověřuje advokáty a vidí jejich doklady.
-- =====================================================================

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

drop policy if exists "staff: vidi tym" on public.staff;
create policy "staff: vidi tym" on public.staff
  for select using (public.is_staff());

-- Nastavení aplikace (např. ceny předplatného), mění je jen tým
create table if not exists public.app_settings (
  key text primary key,
  value integer not null
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings: tym" on public.app_settings;
create policy "app_settings: tym" on public.app_settings
  for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.app_setting(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.app_settings where key = p_key), p_default);
$$;

revoke all on function public.app_setting(text, integer) from public;

-- =====================================================================
-- UPOZORNĚNÍ OD SPRÁVCE PŘÍMO V KANCELÁŘI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěný 00-zaklad.sql (funkce is_staff).
-- Tým ve Správě pošle zprávu vybraným uživatelům. Uživatel ji uvidí na stránce „Dnes“, přečte a potvrdí.
-- Uživatel vidí jen své zprávy a smí u nich jen označit přečtení; zprávy zakládá a maže jen tým.
-- =====================================================================
create table if not exists public.admin_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch uuid not null default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 5 and 1500),
  link text not null default '' check (char_length(link) <= 200 and (link = '' or link like '/%')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists admin_notices_user_idx on public.admin_notices (user_id, read_at, created_at desc);
create index if not exists admin_notices_batch_idx on public.admin_notices (batch);
alter table public.admin_notices enable row level security;

drop policy if exists "admin_notices_select" on public.admin_notices;
create policy "admin_notices_select" on public.admin_notices for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "admin_notices_insert_staff" on public.admin_notices;
create policy "admin_notices_insert_staff" on public.admin_notices for insert with check (public.is_staff());
drop policy if exists "admin_notices_update" on public.admin_notices;
create policy "admin_notices_update" on public.admin_notices for update using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
drop policy if exists "admin_notices_delete_staff" on public.admin_notices;
create policy "admin_notices_delete_staff" on public.admin_notices for delete using (public.is_staff());

-- Uživatel smí změnit jen sloupec read_at (text zprávy ani adresáta nikdy)
create or replace function public.guard_admin_notices()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_staff() then return new; end if;
  if new.user_id is distinct from old.user_id or new.batch is distinct from old.batch or new.title is distinct from old.title
     or new.body is distinct from old.body or new.link is distinct from old.link or new.created_at is distinct from old.created_at then
    raise exception 'Zprávu nelze upravit.';
  end if;
  return new;
end; $$;
drop trigger if exists guard_admin_notices on public.admin_notices;
create trigger guard_admin_notices before update on public.admin_notices for each row execute function public.guard_admin_notices();

-- =====================================================================
-- RECENZE UŽIVATELŮ NA ÚVODNÍ STRÁNCE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěný 00-zaklad.sql (funkce is_staff).
--
-- Uživatel po vyzkoušení aplikace napíše hodnocení. Na úvodní stránku se dostane jen po schválení týmem:
--   status 'pending' (čeká) -> 'approved' (zobrazí se) nebo 'rejected'.
-- Autor může svou recenzi upravit nebo smazat; po úpravě se vrací ke schválení.
-- Souhlas se zveřejněním jména a textu je povinný (sloupec consent musí být true).
-- =====================================================================
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 600),
  display_name text not null check (char_length(display_name) between 2 and 80),
  role_label text not null default '' check (char_length(role_label) <= 80),
  consent boolean not null check (consent),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.testimonials enable row level security;

drop policy if exists "testimonials_own_select" on public.testimonials;
create policy "testimonials_own_select" on public.testimonials for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "testimonials_own_insert" on public.testimonials;
create policy "testimonials_own_insert" on public.testimonials for insert with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "testimonials_own_update" on public.testimonials;
create policy "testimonials_own_update" on public.testimonials for update using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
drop policy if exists "testimonials_own_delete" on public.testimonials;
create policy "testimonials_own_delete" on public.testimonials for delete using (user_id = auth.uid() or public.is_staff());

-- Autor nesmí sám sebe schválit; každá jeho úprava recenzi vrací ke schválení. Rozhoduje jen tým.
create or replace function public.guard_testimonials()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then new.status := 'pending'; return new; end if;
  new.updated_at := now();
  if public.is_staff() then
    if new.status is distinct from old.status then new.decided_at := now(); end if;
    return new;
  end if;
  new.status := 'pending'; new.decided_at := null;
  return new;
end; $$;
drop trigger if exists guard_testimonials on public.testimonials;
create trigger guard_testimonials before insert or update on public.testimonials for each row execute function public.guard_testimonials();

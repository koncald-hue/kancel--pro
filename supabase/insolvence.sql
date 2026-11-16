-- =====================================================================
-- HLÍDÁNÍ V INSOLVENČNÍM REJSTŘÍKU (placený příplatek)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql, role.sql a zruseni-a-zamek.sql.
--
-- Příplatek se kupuje zvlášť od předplatného:
--   * samostatný advokát: platí jen pro něj (lawyer_access.isir_until),
--   * kancelář: platí vedoucí jednou a odemkne se všem členům (firms.isir_until).
-- Každý člen má vlastní seznam hlídaných osob, ostatní kolegové ho nevidí.
-- Ceny: app_settings isir_price_solo_<month|half|year> a isir_price_firm_<month|half|year>.
-- =====================================================================

alter table public.lawyer_access add column if not exists isir_until date;
alter table public.firms add column if not exists isir_until date;

-- Má uživatel aktivní hlídání (vlastní, nebo z kanceláře) a platný přístup?
create or replace function public.has_isir(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_lawyer_access(p_user) and (
    coalesce(public.is_staff(), false)
    or exists (select 1 from public.lawyer_access la where la.user_id = p_user and la.isir_until >= current_date)
    or exists (select 1 from public.firm_members m join public.firms f on f.id = m.firm_id where m.user_id = p_user and f.isir_until >= current_date)
  );
$$;
revoke all on function public.has_isir(uuid) from public;
grant execute on function public.has_isir(uuid) to authenticated, service_role;

create or replace function public.isir_prices()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'solo', json_build_object('month', public.app_setting('isir_price_solo_month', 0), 'half', public.app_setting('isir_price_solo_half', 0), 'year', public.app_setting('isir_price_solo_year', 0)),
    'firm', json_build_object('month', public.app_setting('isir_price_firm_month', 0), 'half', public.app_setting('isir_price_firm_half', 0), 'year', public.app_setting('isir_price_firm_year', 0))
  );
$$;
revoke all on function public.isir_prices() from public;
grant execute on function public.isir_prices() to authenticated;

-- Stav příplatku pro přihlášeného: platí / do kdy / jestli ho může koupit
create or replace function public.isir_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare m public.firm_members; f public.firms; v_own date;
begin
  select * into m from public.firm_members where user_id = auth.uid();
  if found then
    select * into f from public.firms where id = m.firm_id;
    return json_build_object('active', public.has_isir(), 'scope', 'firm', 'until', f.isir_until, 'can_buy', m.role = 'owner', 'firm', f.name);
  end if;
  select isir_until into v_own from public.lawyer_access where user_id = auth.uid();
  return json_build_object('active', public.has_isir(), 'scope', 'solo', 'until', v_own, 'can_buy', true, 'firm', null);
end;
$$;
revoke all on function public.isir_status() from public;
grant execute on function public.isir_status() to authenticated;

create table if not exists public.isir_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_id uuid references public.firms(id) on delete set null,
  plan text not null check (plan in ('month', 'half', 'year')),
  price_czk integer not null check (price_czk > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  provider_ref text,
  paid_at timestamptz,
  period_end date,
  created_at timestamptz not null default now()
);
alter table public.isir_orders enable row level security;
drop policy if exists "isir_orders_select" on public.isir_orders;
create policy "isir_orders_select" on public.isir_orders for select using (user_id = auth.uid() or public.is_staff());

-- Objednávka: samostatný advokát pro sebe, v kanceláři jen vedoucí pro celou kancelář
create or replace function public.create_isir_order(p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare m public.firm_members; v_price integer; v_id uuid; v_firm uuid;
begin
  if p_plan not in ('month', 'half', 'year') then raise exception 'Neplatný tarif.'; end if;
  if not public.has_lawyer_access() then raise exception 'Nejdřív musí být aktivní předplatné.'; end if;
  select * into m from public.firm_members where user_id = auth.uid();
  if found then
    if m.role <> 'owner' then raise exception 'Hlídání insolvence kanceláře objedná vedoucí kanceláře.'; end if;
    v_firm := m.firm_id;
    v_price := public.app_setting('isir_price_firm_' || p_plan, 0);
  else
    v_price := public.app_setting('isir_price_solo_' || p_plan, 0);
  end if;
  if v_price <= 0 then raise exception 'Cena zatím není nastavena.'; end if;
  update public.isir_orders set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  insert into public.isir_orders (user_id, firm_id, plan, price_czk) values (auth.uid(), v_firm, p_plan, v_price) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_isir_order(text) from public;
grant execute on function public.create_isir_order(text) to authenticated;

-- Uplatnění zaplacené objednávky: prodlouží platnost příplatku (kanceláři, nebo samostatnému advokátovi)
create or replace function public.apply_isir_payment(p_order uuid, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare o public.isir_orders; v_start date; v_end date; v_interval interval; v_cur date;
begin
  select * into o from public.isir_orders where id = p_order for update;
  if not found then return 'notfound'; end if;
  if o.status = 'paid' then return 'already'; end if;
  v_interval := case o.plan when 'year' then interval '1 year' when 'half' then interval '6 months' else interval '1 month' end;
  if o.firm_id is not null then
    select isir_until into v_cur from public.firms where id = o.firm_id for update;
    v_start := case when v_cur is not null and v_cur > current_date then v_cur else current_date end;
    v_end := (v_start + v_interval)::date;
    update public.firms set isir_until = v_end where id = o.firm_id;
  else
    select isir_until into v_cur from public.lawyer_access where user_id = o.user_id for update;
    v_start := case when v_cur is not null and v_cur > current_date then v_cur else current_date end;
    v_end := (v_start + v_interval)::date;
    update public.lawyer_access set isir_until = v_end where user_id = o.user_id;
  end if;
  update public.isir_orders set status = 'paid', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now(), period_end = v_end where id = o.id;
  return 'ok';
end;
$$;
revoke all on function public.apply_isir_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_isir_payment(uuid, text) to service_role;

-- Ruční potvrzení platby nebo přidělení příplatku týmem (dokud není platební brána)
create or replace function public.staff_confirm_isir_order(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  return public.apply_isir_payment(p_order, 'ruční potvrzení');
end;
$$;
revoke all on function public.staff_confirm_isir_order(uuid) from public;
grant execute on function public.staff_confirm_isir_order(uuid) to authenticated;

create or replace function public.staff_grant_isir(p_email text, p_months integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid; m public.firm_members; v_until date;
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  if p_months < 1 or p_months > 24 then raise exception 'Počet měsíců musí být 1 až 24.'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(coalesce(p_email, '')));
  if v_user is null then raise exception 'Uživatel s tímto e-mailem neexistuje.'; end if;
  v_until := (current_date + make_interval(months => p_months))::date;
  select * into m from public.firm_members where user_id = v_user;
  if found then
    if m.role <> 'owner' then raise exception 'Uživatel je členem kanceláře, ne jejím vedoucím. Přidělte příplatek vedoucímu.'; end if;
    update public.firms set isir_until = v_until where id = m.firm_id;
    return format('Hlídání insolvence pro celou kancelář do %s.', to_char(v_until, 'DD. MM. YYYY'));
  end if;
  update public.lawyer_access set isir_until = v_until where user_id = v_user;
  if not found then raise exception 'Uživatel zatím nemá přístup do Kanceláře.'; end if;
  return format('Hlídání insolvence pro uživatele do %s.', to_char(v_until, 'DD. MM. YYYY'));
end;
$$;
revoke all on function public.staff_grant_isir(text, integer) from public;
grant execute on function public.staff_grant_isir(text, integer) to authenticated;

-- Hlídané osoby (soukromé pro každého člena)
create table if not exists public.isir_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  kind text not null check (kind in ('firma', 'osoba')),
  ic text not null default '',
  name text not null default '',        -- u osoby příjmení
  first_name text not null default '',
  birth date,
  note text not null default '' check (char_length(note) <= 500),
  last_checked_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  check ((kind = 'firma' and ic ~ '^[0-9]{8}$') or (kind = 'osoba' and char_length(name) >= 2 and char_length(first_name) >= 2 and birth is not null))
);
create index if not exists isir_watches_user_idx on public.isir_watches (user_id);
alter table public.isir_watches enable row level security;
drop policy if exists "isir_watches_select" on public.isir_watches;
create policy "isir_watches_select" on public.isir_watches for select using (user_id = auth.uid());
drop policy if exists "isir_watches_insert" on public.isir_watches;
create policy "isir_watches_insert" on public.isir_watches for insert with check (user_id = auth.uid() and public.has_isir());
drop policy if exists "isir_watches_delete" on public.isir_watches;
create policy "isir_watches_delete" on public.isir_watches for delete using (user_id = auth.uid());

-- Nálezy v rejstříku; zapisuje je jen server po zaplaceném příplatku
create table if not exists public.isir_hits (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.isir_watches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  spis text not null,
  court text not null default '',
  debtor text not null default '',
  state text not null default '',
  started date,
  ended date,
  url text not null default '',
  seen boolean not null default false,
  first_seen_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  unique (watch_id, spis)
);
alter table public.isir_hits enable row level security;
drop policy if exists "isir_hits_select" on public.isir_hits;
create policy "isir_hits_select" on public.isir_hits for select using (user_id = auth.uid());
drop policy if exists "isir_hits_update" on public.isir_hits;
create policy "isir_hits_update" on public.isir_hits for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "isir_hits_delete" on public.isir_hits;
create policy "isir_hits_delete" on public.isir_hits for delete using (user_id = auth.uid());

-- Nejvýše 50 hlídaných osob na uživatele
create or replace function public.limit_isir_watches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.isir_watches where user_id = new.user_id) >= 50 then raise exception 'Hlídat lze nejvýše 50 osob. Odeberte některou ze seznamu.'; end if;
  return new;
end; $$;
drop trigger if exists limit_isir_watches on public.isir_watches;
create trigger limit_isir_watches before insert on public.isir_watches for each row execute function public.limit_isir_watches();

-- Zámek po skončení předplatného platí i tady
drop trigger if exists lock_when_expired on public.isir_watches;
create trigger lock_when_expired before insert or update or delete on public.isir_watches for each row execute function public.block_when_locked();

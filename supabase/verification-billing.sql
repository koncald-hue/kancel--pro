-- =====================================================================
-- OVĚŘENÍ PRŮKAZEM (ŠIFROVANĚ PRO SPRÁVCE) A PŘEDPLATNÉ ADVOKÁTŮ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run (zvol "Run and enable RLS").
-- Nejdřív musí být spuštěné lawyer.sql, client-identity.sql a verification-e2ee.sql.
--
-- Průkaz advokáta se šifruje v prohlížeči žadatele veřejným klíčem správce. Přečte ho jen správce
-- svým soukromým klíčem (zašifrovaným jeho heslem). Po schválení i zamítnutí se soubor i záznam smaží.
-- Předplatné lze objednat jen po ověření, a platba bez ověření se nikdy neaktivuje (označí se k vrácení).
-- =====================================================================

-- Klíč správce: veřejná část ke čtení všem přihlášeným, soukromá (zašifrovaná heslem) jen týmu
create table if not exists public.admin_keys (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_secret (
  id integer primary key default 1 check (id = 1),
  salt text not null,
  wrapped_private text not null
);

-- Zašifrovaný průkaz žadatele (jeden na uživatele); klíč souboru je zabalený klíčem správce
create table if not exists public.verification_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  path text not null,
  wrapped_key text not null,
  created_at timestamptz not null default now()
);

-- Objednávky předplatného advokátů
create table if not exists public.lawyer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('month', 'year')),
  price_czk integer not null check (price_czk > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refund_due')),
  provider_ref text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  period_start date,
  period_end date
);
create index if not exists lawyer_orders_user_idx on public.lawyer_orders (user_id, created_at desc);

alter table public.admin_keys enable row level security;
alter table public.admin_secret enable row level security;
alter table public.verification_docs enable row level security;
alter table public.lawyer_orders enable row level security;

drop policy if exists "admin_keys_read" on public.admin_keys;
create policy "admin_keys_read" on public.admin_keys for select to authenticated using (true);
drop policy if exists "admin_keys_staff" on public.admin_keys;
create policy "admin_keys_staff" on public.admin_keys for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "admin_secret_staff" on public.admin_secret;
create policy "admin_secret_staff" on public.admin_secret for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "verification_docs_own_insert" on public.verification_docs;
create policy "verification_docs_own_insert" on public.verification_docs for insert with check (auth.uid() = user_id);
drop policy if exists "verification_docs_own_select" on public.verification_docs;
create policy "verification_docs_own_select" on public.verification_docs for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "verification_docs_delete" on public.verification_docs;
create policy "verification_docs_delete" on public.verification_docs for delete using (auth.uid() = user_id or public.is_staff());

drop policy if exists "lawyer_orders_select" on public.lawyer_orders;
create policy "lawyer_orders_select" on public.lawyer_orders for select using (auth.uid() = user_id or public.is_staff());

grant select on public.admin_keys to authenticated;
grant insert, update, delete on public.admin_keys to authenticated;
grant select, insert, update, delete on public.admin_secret to authenticated;
grant select, insert, delete on public.verification_docs to authenticated;
grant select on public.lawyer_orders to authenticated;

-- Soukromé úložiště průkazů: žadatel nahrává jen do své složky, čte a maže jen tým
insert into storage.buckets (id, name, public, file_size_limit)
values ('verification-docs', 'verification-docs', false, 8388608)
on conflict (id) do update set public = false, file_size_limit = 8388608;

drop policy if exists "verification-docs: zadatel nahrava" on storage.objects;
create policy "verification-docs: zadatel nahrava" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "verification-docs: tym cte a maze" on storage.objects;
create policy "verification-docs: tym cte a maze" on storage.objects
  for all to authenticated
  using (bucket_id = 'verification-docs' and public.is_staff())
  with check (bucket_id = 'verification-docs' and public.is_staff());
drop policy if exists "verification-docs: zadatel maze sve" on storage.objects;
create policy "verification-docs: zadatel maze sve" on storage.objects
  for delete to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Žádost o ověření: bez nahraného průkazu ji nelze podat
create or replace function public.request_lawyer_verification(p_profession text, p_register_name text, p_bar text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.verification_docs where user_id = auth.uid()) then
    raise exception 'Nejdřív nahrajte průkaz.';
  end if;
  update public.lawyer_access set
    profession = case when p_profession = 'jiny' then 'jiny' else 'advokat' end,
    register_name = left(coalesce(p_register_name, ''), 160),
    bar_number = left(coalesce(p_bar, ''), 40),
    verification_status = 'pending',
    verification_note = ''
  where user_id = auth.uid() and verification_status <> 'verified';
end;
$$;
revoke all on function public.request_lawyer_verification(text, text, text) from public;
grant execute on function public.request_lawyer_verification(text, text, text) to authenticated;

-- Rozhodnutí správce: smaže záznam o průkazu (soubor smaže správce přes úložiště těsně předtím)
-- a při odebrání ověření zruší přístup a označí zaplacené objednávky k vrácení peněz
create or replace function public.decide_lawyer_verification(p_user uuid, p_ok boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  update public.lawyer_access set
    verification_status = case when p_ok then 'verified' else 'rejected' end,
    verified_at = case when p_ok then now() else null end,
    verification_note = case when p_ok then '' else left(coalesce(p_note, ''), 300) end
  where user_id = p_user;
  delete from public.verification_docs where user_id = p_user;
  if not p_ok then
    update public.lawyer_orders set status = 'refund_due' where user_id = p_user and status = 'paid' and period_end >= current_date;
    update public.lawyer_access set status = 'expired', until = current_date where user_id = p_user and status = 'active';
  end if;
end;
$$;
revoke all on function public.decide_lawyer_verification(uuid, boolean, text) from public;
grant execute on function public.decide_lawyer_verification(uuid, boolean, text) to authenticated;

-- Ceny (v Kč) se nastavují v app_settings: lawyer_price_month a lawyer_price_year
create or replace function public.lawyer_prices()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('month', public.app_setting('lawyer_price_month', 0), 'year', public.app_setting('lawyer_price_year', 0));
$$;
revoke all on function public.lawyer_prices() from public;
grant execute on function public.lawyer_prices() to authenticated;

-- Objednávka předplatného: jen ověřený advokát a jen při nastavené ceně
create or replace function public.create_lawyer_order(p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_price integer; v_id uuid;
begin
  if p_plan not in ('month', 'year') then raise exception 'Neplatný tarif.'; end if;
  if not exists (select 1 from public.lawyer_access where user_id = auth.uid() and verification_status = 'verified') then
    raise exception 'Předplatné lze koupit až po ověření totožnosti.';
  end if;
  v_price := public.app_setting(case when p_plan = 'month' then 'lawyer_price_month' else 'lawyer_price_year' end, 0);
  if v_price <= 0 then raise exception 'Cena zatím není nastavena.'; end if;
  update public.lawyer_orders set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  insert into public.lawyer_orders (user_id, plan, price_czk) values (auth.uid(), p_plan, v_price) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_lawyer_order(text) from public;
grant execute on function public.create_lawyer_order(text) to authenticated;

-- Uplatnění zaplacené objednávky. Platba neověřeného advokáta se NIKDY neaktivuje, označí se k vrácení.
create or replace function public.apply_lawyer_payment(p_order uuid, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare o public.lawyer_orders; la public.lawyer_access; v_start date; v_end date;
begin
  select * into o from public.lawyer_orders where id = p_order for update;
  if not found then return 'notfound'; end if;
  if o.status in ('paid', 'refund_due') then return 'already'; end if;
  select * into la from public.lawyer_access where user_id = o.user_id;
  if not found or la.verification_status <> 'verified' then
    update public.lawyer_orders set status = 'refund_due', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now() where id = o.id;
    return 'refund_due';
  end if;
  v_start := case when la.status = 'active' and la.until is not null and la.until > current_date then la.until else current_date end;
  v_end := (v_start + case when o.plan = 'year' then interval '1 year' else interval '1 month' end)::date;
  update public.lawyer_orders set status = 'paid', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now(), period_start = v_start, period_end = v_end where id = o.id;
  update public.lawyer_access set status = 'active', until = v_end where user_id = o.user_id;
  return 'ok';
end;
$$;
revoke all on function public.apply_lawyer_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_lawyer_payment(uuid, text) to service_role;

-- Nouzové ruční potvrzení platby členem týmu (běžně to dělá platební brána přes webhook)
create or replace function public.staff_mark_order_paid(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  return public.apply_lawyer_payment(p_order, 'ruční potvrzení');
end;
$$;
revoke all on function public.staff_mark_order_paid(uuid) from public;
grant execute on function public.staff_mark_order_paid(uuid) to authenticated;

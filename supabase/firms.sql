-- =====================================================================
-- ADVOKÁTNÍ KANCELÁŘE (balíčky pro více advokátů)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné všechny ostatní soubory včetně pul-rocni-plan.sql.
--
-- Model:
--   * Kancelář (firms) má jednoho vedoucího (vlastníka), který platí balíček s počtem míst 3, 5 nebo 10.
--   * Každý advokát má vlastní účet, heslo, vlastní šifrovací klíče a vlastní data (věci, klienty, výkazy).
--     Vedoucí kanceláře NEVIDÍ jejich věci ani klienty, jen seznam členů a stav (jméno, e-mail, ověření, přístup).
--   * Člena vedoucí zve odkazem. Pozvánka je jednorázová, platí 14 dní a jen pro daný e-mail.
--   * Přístup člena se odvozuje z balíčku kanceláře: platba kanceláře nastaví přístup (lawyer_access) všem členům.
--     Každý člen se ověřuje sám (klientské odkazy fungují jen ověřenému advokátovi).
-- =====================================================================

create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  seats integer not null default 0 check (seats in (0, 3, 5, 10)),
  until date,
  created_at timestamptz not null default now()
);

create table if not exists public.firm_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now()
);
create index if not exists firm_members_firm_idx on public.firm_members (firm_id);

create table if not exists public.firm_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  email text not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked boolean not null default false
);
create index if not exists firm_invites_firm_idx on public.firm_invites (firm_id);

alter table public.lawyer_access add column if not exists firm_id uuid references public.firms(id) on delete set null;
alter table public.lawyer_orders add column if not exists seats integer check (seats in (3, 5, 10));
alter table public.lawyer_orders add column if not exists firm_id uuid references public.firms(id) on delete set null;

alter table public.firms enable row level security;
alter table public.firm_members enable row level security;
alter table public.firm_invites enable row level security;

-- Přímo smí číst jen sám sebe; ostatní jde jen přes funkce níže (ty hlídají roli)
drop policy if exists "firms_select" on public.firms;
create policy "firms_select" on public.firms for select using (
  owner_id = auth.uid() or public.is_staff() or exists (select 1 from public.firm_members m where m.firm_id = id and m.user_id = auth.uid())
);
drop policy if exists "firm_members_select" on public.firm_members;
create policy "firm_members_select" on public.firm_members for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "firm_invites_staff" on public.firm_invites;
create policy "firm_invites_staff" on public.firm_invites for select using (public.is_staff());

revoke all on public.firms, public.firm_members, public.firm_invites from anon, authenticated;
grant select on public.firms, public.firm_members, public.firm_invites to authenticated;

-- Přehled kanceláře. Vedoucí uvidí členy (jméno, e-mail, ověření, přístup) a otevřené pozvánky, člen jen název kanceláře.
create or replace function public.firm_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare m public.firm_members; f public.firms; res jsonb;
begin
  select * into m from public.firm_members where user_id = auth.uid();
  if not found then return null; end if;
  select * into f from public.firms where id = m.firm_id;
  res := jsonb_build_object('firm', jsonb_build_object('id', f.id, 'name', f.name, 'seats', f.seats, 'until', f.until, 'role', m.role));
  if m.role = 'owner' then
    res := res || jsonb_build_object(
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'user_id', fm.user_id, 'role', fm.role, 'joined_at', fm.joined_at,
          'email', coalesce(la.email, ''),
          'name', coalesce(nullif(la.display_name, ''), ''),
          'verification', coalesce(la.verification_status, 'none'),
          'status', coalesce(la.status, 'expired'),
          'until', la.until
        ) order by fm.joined_at), '[]'::jsonb)
        from public.firm_members fm left join public.lawyer_access la on la.user_id = fm.user_id
        where fm.firm_id = f.id
      ),
      'invites', (
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'token', i.token, 'expires_at', i.expires_at) order by i.created_at), '[]'::jsonb)
        from public.firm_invites i
        where i.firm_id = f.id and i.accepted_at is null and not i.revoked and i.expires_at > now()
      )
    );
  end if;
  return res;
end;
$$;
revoke all on function public.firm_overview() from public;
grant execute on function public.firm_overview() to authenticated;

-- Založení kanceláře: advokát s vlastním přístupem (zkušebním nebo placeným) se stane jejím vedoucím
create or replace function public.create_firm(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Přihlaste se.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Název kanceláře musí mít 2 až 120 znaků.'; end if;
  if not exists (select 1 from public.lawyer_access where user_id = auth.uid()) then raise exception 'Nejdřív zahajte zkušební přístup.'; end if;
  if exists (select 1 from public.firm_members where user_id = auth.uid()) then raise exception 'Už jste členem kanceláře.'; end if;
  insert into public.firms (owner_id, name) values (auth.uid(), v_name) returning id into v_id;
  insert into public.firm_members (user_id, firm_id, role) values (auth.uid(), v_id, 'owner');
  return v_id;
end;
$$;
revoke all on function public.create_firm(text) from public;
grant execute on function public.create_firm(text) to authenticated;

-- Pozvánka člena (jen vedoucí). Vrací tajný kód pro odkaz /pozvanka/<kód>.
create or replace function public.invite_firm_member(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; v_email text := lower(btrim(coalesce(p_email, ''))); v_used integer; v_token text;
begin
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role = 'owner' where m.user_id = auth.uid() for update of fi;
  if not found then raise exception 'Pozvánky smí posílat jen vedoucí kanceláře.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then raise exception 'Zadejte platný e-mail.'; end if;
  if f.seats <= 0 or f.until is null or f.until < current_date then raise exception 'Nejdřív pořiďte balíček pro kancelář (nebo ho obnovte).'; end if;
  if exists (select 1 from public.firm_members fm join public.lawyer_access la on la.user_id = fm.user_id where fm.firm_id = f.id and lower(la.email) = v_email) then raise exception 'Tento advokát už je členem kanceláře.'; end if;
  update public.firm_invites set revoked = true where firm_id = f.id and lower(email) = v_email and accepted_at is null and not revoked;
  select (select count(*) from public.firm_members where firm_id = f.id)
       + (select count(*) from public.firm_invites where firm_id = f.id and accepted_at is null and not revoked and expires_at > now()) into v_used;
  if v_used >= f.seats then raise exception 'Všechna místa v balíčku jsou obsazená nebo rezervovaná pozvánkou.'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.firm_invites (firm_id, email, token) values (f.id, v_email, v_token);
  return v_token;
end;
$$;
revoke all on function public.invite_firm_member(text) from public;
grant execute on function public.invite_firm_member(text) to authenticated;

create or replace function public.revoke_firm_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.firm_invites i set revoked = true
  where i.id = p_invite and i.accepted_at is null
    and exists (select 1 from public.firm_members m where m.firm_id = i.firm_id and m.user_id = auth.uid() and m.role = 'owner');
end;
$$;
revoke all on function public.revoke_firm_invite(uuid) from public;
grant execute on function public.revoke_firm_invite(uuid) to authenticated;

-- Přijetí pozvánky: jen pod účtem se stejným e-mailem, na který byla pozvánka vystavena
create or replace function public.accept_firm_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare i public.firm_invites; f public.firms; v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Přihlaste se.'; end if;
  select * into i from public.firm_invites where token = coalesce(p_token, '') for update;
  if not found or i.revoked or i.accepted_at is not null or i.expires_at < now() then raise exception 'Pozvánka je neplatná nebo vypršela.'; end if;
  if v_email = '' or v_email <> lower(i.email) then raise exception 'Pozvánka je určena pro jiný e-mail. Přihlaste se účtem, na který byla vystavena.'; end if;
  if exists (select 1 from public.firm_members where user_id = auth.uid()) then raise exception 'Už jste členem kanceláře.'; end if;
  select * into f from public.firms where id = i.firm_id for update;
  if f.until is null or f.until < current_date then raise exception 'Předplatné kanceláře vypršelo. Požádejte vedoucího o obnovení.'; end if;
  if (select count(*) from public.firm_members where firm_id = f.id) >= f.seats then raise exception 'V kanceláři už není volné místo.'; end if;
  insert into public.firm_members (user_id, firm_id, role) values (auth.uid(), f.id, 'member');
  update public.firm_invites set accepted_at = now() where id = i.id;
  -- Přístup z balíčku kanceláře; vlastní delší placený přístup se nepřepisuje
  insert into public.lawyer_access (user_id, email, status, until, firm_id) values (auth.uid(), v_email, 'active', f.until, f.id)
  on conflict (user_id) do update set status = 'active', until = f.until, firm_id = f.id
  where public.lawyer_access.status <> 'active' or public.lawyer_access.until is null or public.lawyer_access.until < f.until;
  return f.name;
end;
$$;
revoke all on function public.accept_firm_invite(text) from public;
grant execute on function public.accept_firm_invite(text) to authenticated;

-- Odebrání člena vedoucím a odchod člena. Odebraný člen ztratí přístup z kanceláře; jeho data zůstávají jen jeho.
create or replace function public.remove_firm_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms;
begin
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role = 'owner' where m.user_id = auth.uid();
  if not found then raise exception 'Členy smí odebírat jen vedoucí kanceláře.'; end if;
  if p_user = auth.uid() then raise exception 'Vedoucího kanceláře nelze odebrat.'; end if;
  delete from public.firm_members where user_id = p_user and firm_id = f.id;
  update public.lawyer_access set status = 'expired', until = current_date - 1, firm_id = null where user_id = p_user and firm_id = f.id;
end;
$$;
revoke all on function public.remove_firm_member(uuid) from public;
grant execute on function public.remove_firm_member(uuid) to authenticated;

create or replace function public.leave_firm()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare m public.firm_members;
begin
  select * into m from public.firm_members where user_id = auth.uid();
  if not found then return; end if;
  if m.role = 'owner' then raise exception 'Vedoucí kancelář opustit nemůže.'; end if;
  delete from public.firm_members where user_id = auth.uid();
  update public.lawyer_access set status = 'expired', until = current_date - 1, firm_id = null where user_id = auth.uid() and firm_id = m.firm_id;
end;
$$;
revoke all on function public.leave_firm() from public;
grant execute on function public.leave_firm() to authenticated;

-- Ceny balíčků pro kanceláře: app_settings firm_price_<místa>_<tarif>, např. firm_price_5_year
create or replace function public.firm_prices()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    '3', json_build_object('month', public.app_setting('firm_price_3_month', 0), 'half', public.app_setting('firm_price_3_half', 0), 'year', public.app_setting('firm_price_3_year', 0)),
    '5', json_build_object('month', public.app_setting('firm_price_5_month', 0), 'half', public.app_setting('firm_price_5_half', 0), 'year', public.app_setting('firm_price_5_year', 0)),
    '10', json_build_object('month', public.app_setting('firm_price_10_month', 0), 'half', public.app_setting('firm_price_10_half', 0), 'year', public.app_setting('firm_price_10_year', 0))
  );
$$;
revoke all on function public.firm_prices() from public;
grant execute on function public.firm_prices() to anon, authenticated;

-- Objednávka balíčku: jen vedoucí kanceláře s ověřenou totožností
create or replace function public.create_firm_order(p_plan text, p_seats integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; v_price integer; v_id uuid; v_members integer;
begin
  if p_plan not in ('month', 'half', 'year') then raise exception 'Neplatný tarif.'; end if;
  if p_seats not in (3, 5, 10) then raise exception 'Neplatný počet míst.'; end if;
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role = 'owner' where m.user_id = auth.uid();
  if not found then raise exception 'Balíček může objednat jen vedoucí kanceláře.'; end if;
  if not exists (select 1 from public.lawyer_access where user_id = auth.uid() and verification_status = 'verified') then
    raise exception 'Předplatné lze koupit až po ověření totožnosti.';
  end if;
  select count(*) into v_members from public.firm_members where firm_id = f.id;
  if v_members > p_seats then raise exception 'V kanceláři je více členů, než kolik míst má vybraný balíček.'; end if;
  v_price := public.app_setting('firm_price_' || p_seats || '_' || p_plan, 0);
  if v_price <= 0 then raise exception 'Cena zatím není nastavena.'; end if;
  update public.lawyer_orders set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  insert into public.lawyer_orders (user_id, plan, price_czk, seats, firm_id) values (auth.uid(), p_plan, v_price, p_seats, f.id) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_firm_order(text, integer) from public;
grant execute on function public.create_firm_order(text, integer) to authenticated;

-- Uplatnění zaplacené objednávky (individuální i balíčku kanceláře). Platba neověřeného se NIKDY neaktivuje, označí se k vrácení.
create or replace function public.apply_lawyer_payment(p_order uuid, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare o public.lawyer_orders; la public.lawyer_access; f public.firms; v_start date; v_end date; v_interval interval;
begin
  select * into o from public.lawyer_orders where id = p_order for update;
  if not found then return 'notfound'; end if;
  if o.status in ('paid', 'refund_due') then return 'already'; end if;
  select * into la from public.lawyer_access where user_id = o.user_id;
  if not found or la.verification_status <> 'verified' then
    update public.lawyer_orders set status = 'refund_due', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now() where id = o.id;
    return 'refund_due';
  end if;
  v_interval := case o.plan when 'year' then interval '1 year' when 'half' then interval '6 months' else interval '1 month' end;

  if o.seats is not null then
    select * into f from public.firms where id = o.firm_id and owner_id = o.user_id for update;
    if not found then
      update public.lawyer_orders set status = 'refund_due', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now() where id = o.id;
      return 'refund_due';
    end if;
    v_start := case when f.until is not null and f.until > current_date then f.until else current_date end;
    v_end := (v_start + v_interval)::date;
    update public.lawyer_orders set status = 'paid', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now(), period_start = v_start, period_end = v_end where id = o.id;
    update public.firms set seats = o.seats, until = v_end where id = f.id;
    -- všem členům (včetně vedoucího) se nastaví přístup z balíčku; vlastní delší placený přístup zůstává
    update public.lawyer_access l set status = 'active', until = v_end, firm_id = f.id
    from public.firm_members m
    where m.firm_id = f.id and l.user_id = m.user_id
      and (l.firm_id = f.id or (l.firm_id is null and (l.status <> 'active' or l.until is null or l.until < v_end)));
    return 'ok';
  end if;

  v_start := case when la.status = 'active' and la.until is not null and la.until > current_date then la.until else current_date end;
  v_end := (v_start + v_interval)::date;
  update public.lawyer_orders set status = 'paid', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now(), period_start = v_start, period_end = v_end where id = o.id;
  update public.lawyer_access set status = 'active', until = v_end where user_id = o.user_id;
  return 'ok';
end;
$$;
revoke all on function public.apply_lawyer_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_lawyer_payment(uuid, text) to service_role;

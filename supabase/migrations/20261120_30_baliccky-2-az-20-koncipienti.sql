-- Balíčky pro kanceláře 2 / 3 / 5 / 10 / 20 advokátů a místa pro koncipienty zdarma navíc:
-- 2 → +1, 3 → +1, 5 → +2, 10 → +4, 20 → +8. Koncipient je člen s příznakem trainee; pozvat ho jako koncipienta může vedoucí nebo správce.

-- 1) Povolené velikosti balíčku
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.firms'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%seats%' loop
    execute format('alter table public.firms drop constraint %I', c);
  end loop;
  for c in select conname from pg_constraint where conrelid = 'public.lawyer_orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%seats%' loop
    execute format('alter table public.lawyer_orders drop constraint %I', c);
  end loop;
end $$;
alter table public.firms add constraint firms_seats_check check (seats in (0, 2, 3, 5, 10, 20));
alter table public.lawyer_orders add constraint lawyer_orders_seats_check check (seats is null or seats in (2, 3, 5, 10, 20));

-- 2) Příznak koncipienta u členů a pozvánek
alter table public.firm_members add column if not exists trainee boolean not null default false;
alter table public.firm_invites add column if not exists trainee boolean not null default false;

create or replace function public.trainee_seats(p_seats integer)
returns integer
language sql
immutable
as $$ select case p_seats when 2 then 1 when 3 then 1 when 5 then 2 when 10 then 4 when 20 then 8 else 0 end; $$;
grant execute on function public.trainee_seats(integer) to anon, authenticated;

-- 3) Pozvánka (advokát nebo koncipient)
drop function if exists public.invite_firm_member(text, text);
create or replace function public.invite_firm_member(p_email text, p_name text, p_trainee boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; v_email text := lower(btrim(coalesce(p_email, ''))); v_name text := btrim(coalesce(p_name, '')); v_used integer; v_token text; v_trainee boolean := coalesce(p_trainee, false);
begin
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role in ('owner', 'admin') where m.user_id = auth.uid() for update of fi;
  if not found then raise exception 'Pozvánky smí posílat jen vedoucí nebo správce kanceláře.'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 then raise exception 'Zadejte jméno kolegy (alespoň 3 znaky).'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then raise exception 'Zadejte platný e-mail.'; end if;
  if f.seats <= 0 or f.until is null or f.until < current_date then raise exception 'Nejdřív pořiďte balíček pro kancelář (nebo ho obnovte).'; end if;
  if exists (select 1 from public.firm_members fm join public.lawyer_access la on la.user_id = fm.user_id where fm.firm_id = f.id and lower(la.email) = v_email) then raise exception 'Tento advokát už je členem kanceláře.'; end if;
  update public.firm_invites set revoked = true where firm_id = f.id and lower(email) = v_email and accepted_at is null and not revoked;
  select (select count(*) from public.firm_members where firm_id = f.id and trainee = v_trainee)
       + (select count(*) from public.firm_invites where firm_id = f.id and trainee = v_trainee and accepted_at is null and not revoked and expires_at > now()) into v_used;
  if v_used >= case when v_trainee then public.trainee_seats(f.seats) else f.seats end then
    raise exception '%', case when v_trainee then 'Všechna místa pro koncipienty jsou obsazená nebo rezervovaná pozvánkou.' else 'Všechna místa v balíčku jsou obsazená nebo rezervovaná pozvánkou.' end;
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.firm_invites (firm_id, email, name, token, trainee) values (f.id, v_email, v_name, v_token, v_trainee);
  return v_token;
end;
$$;
revoke all on function public.invite_firm_member(text, text, boolean) from public;
grant execute on function public.invite_firm_member(text, text, boolean) to authenticated;

-- 4) Přijetí pozvánky
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
  if (select count(*) from public.firm_members where firm_id = f.id and trainee = i.trainee) >= case when i.trainee then public.trainee_seats(f.seats) else f.seats end then raise exception 'V kanceláři už není volné místo.'; end if;
  insert into public.firm_members (user_id, firm_id, role, trainee) values (auth.uid(), f.id, 'member', i.trainee);
  update public.firm_invites set accepted_at = now() where id = i.id;
  insert into public.lawyer_access (user_id, email, status, until, firm_id, display_name) values (auth.uid(), v_email, 'active', f.until, f.id, i.name)
  on conflict (user_id) do update set status = 'active', until = f.until, firm_id = f.id
  where public.lawyer_access.status <> 'active' or public.lawyer_access.until is null or public.lawyer_access.until < f.until;
  update public.lawyer_access set display_name = i.name where user_id = auth.uid() and btrim(coalesce(display_name, '')) = '';
  return f.name;
end;
$$;
revoke all on function public.accept_firm_invite(text) from public;
grant execute on function public.accept_firm_invite(text) to authenticated;

-- 5) Přehled kanceláře (s příznakem koncipienta a počtem jeho míst)
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
  res := jsonb_build_object('firm', jsonb_build_object('id', f.id, 'name', f.name, 'seats', f.seats, 'trainee_seats', public.trainee_seats(f.seats), 'until', f.until, 'role', m.role));
  if m.role in ('owner', 'admin') then
    res := res || jsonb_build_object(
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'user_id', fm.user_id, 'role', fm.role, 'trainee', fm.trainee, 'joined_at', fm.joined_at,
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
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'name', i.name, 'token', i.token, 'trainee', i.trainee, 'expires_at', i.expires_at) order by i.created_at), '[]'::jsonb)
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

-- 6) Ceny balíčků
create or replace function public.firm_prices()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_object_agg(n, json_build_object(
    'month', public.app_setting('firm_price_' || n || '_month', 0),
    'half', public.app_setting('firm_price_' || n || '_half', 0),
    'year', public.app_setting('firm_price_' || n || '_year', 0)))
  from unnest(array[2, 3, 5, 10, 20]) as n;
$$;
revoke all on function public.firm_prices() from public;
grant execute on function public.firm_prices() to anon, authenticated;

-- 7) Objednávka balíčku: nové velikosti; kontrola jen podle advokátů (koncipienti se do míst nepočítají)
create or replace function public.create_firm_order(p_plan text, p_seats integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; v_price integer; v_id uuid; v_members integer; v_trainees integer;
begin
  if p_plan not in ('month', 'half', 'year') then raise exception 'Neplatný tarif.'; end if;
  if p_seats not in (2, 3, 5, 10, 20) then raise exception 'Neplatný počet míst.'; end if;
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role = 'owner' where m.user_id = auth.uid();
  if not found then raise exception 'Balíček může objednat jen vedoucí kanceláře.'; end if;
  if not exists (select 1 from public.lawyer_access where user_id = auth.uid() and verification_status = 'verified') then
    raise exception 'Předplatné lze koupit až po ověření totožnosti.';
  end if;
  select count(*) filter (where not trainee), count(*) filter (where trainee) into v_members, v_trainees from public.firm_members where firm_id = f.id;
  if v_members > p_seats then raise exception 'V kanceláři je více advokátů, než kolik míst má vybraný balíček.'; end if;
  if v_trainees > public.trainee_seats(p_seats) then raise exception 'V kanceláři je více koncipientů, než kolik míst pro ně má vybraný balíček.'; end if;
  v_price := public.app_setting('firm_price_' || p_seats || '_' || p_plan, 0);
  if v_price <= 0 then raise exception 'Cena zatím není nastavena.'; end if;
  update public.lawyer_orders set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  insert into public.lawyer_orders (user_id, plan, price_czk, seats, firm_id) values (auth.uid(), p_plan, v_price, p_seats, f.id) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_firm_order(text, integer) from public;
grant execute on function public.create_firm_order(text, integer) to authenticated;

-- 8) Testovací balíček od týmu: nové velikosti
create or replace function public.staff_grant_firm_package(p_email text, p_seats integer, p_months integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid; v_firm public.firms; v_until date;
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  if p_seats not in (2, 3, 5, 10, 20) then raise exception 'Počet míst musí být 2, 3, 5, 10 nebo 20.'; end if;
  if p_months < 1 or p_months > 24 then raise exception 'Počet měsíců musí být 1 až 24.'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(coalesce(p_email, '')));
  if v_user is null then raise exception 'Uživatel s tímto e-mailem neexistuje. Nejdřív se musí zaregistrovat.'; end if;
  select f.* into v_firm from public.firms f join public.firm_members m on m.firm_id = f.id and m.role = 'owner' where m.user_id = v_user;
  if not found then
    if exists (select 1 from public.firm_members where user_id = v_user) then raise exception 'Uživatel je členem cizí kanceláře, ne jejím vedoucím.'; end if;
    insert into public.firms (owner_id, name) values (v_user, 'Testovací kancelář') returning * into v_firm;
    insert into public.firm_members (user_id, firm_id, role) values (v_user, v_firm.id, 'owner');
  end if;
  v_until := (current_date + make_interval(months => p_months))::date;
  update public.firms set seats = p_seats, until = v_until where id = v_firm.id;
  insert into public.lawyer_access (user_id, email, status, until, firm_id)
    select v_user, u.email, 'active', v_until, v_firm.id from auth.users u where u.id = v_user
  on conflict (user_id) do nothing;
  update public.lawyer_access l set status = 'active', until = v_until, firm_id = v_firm.id
    from public.firm_members m
    where m.firm_id = v_firm.id and l.user_id = m.user_id
      and (l.firm_id = v_firm.id or (l.firm_id is null and (l.status <> 'active' or l.until is null or l.until < v_until)));
  return format('Kancelář „%s“: balíček pro %s do %s.', v_firm.name, p_seats, to_char(v_until, 'DD. MM. YYYY'));
end;
$$;
revoke all on function public.staff_grant_firm_package(text, integer, integer) from public;
grant execute on function public.staff_grant_firm_package(text, integer, integer) to authenticated;

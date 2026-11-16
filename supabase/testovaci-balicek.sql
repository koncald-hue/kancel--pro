-- =====================================================================
-- TESTOVACÍ BALÍČEK KANCELÁŘE (jen pro tým)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql.
--
-- Funkce staff_grant_firm_package(e-mail, počet míst, počet měsíců) smí zavolat jen člen týmu. Uživateli s daným
-- e-mailem založí kancelář (pokud žádnou nemá) a nastaví jí balíček bez placení. Slouží k vyzkoušení balíčků
-- a ke zkoušení před zapojením platební brány. Platí pro všechny členy kanceláře.
-- =====================================================================

create or replace function public.staff_grant_firm_package(p_email text, p_seats integer, p_months integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid; v_firm public.firms; v_until date;
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  if p_seats not in (3, 5, 10) then raise exception 'Počet míst musí být 3, 5 nebo 10.'; end if;
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

  -- přístup vedoucímu (a členům) z balíčku; pokud vedoucí ještě nemá přístup, vznikne mu
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

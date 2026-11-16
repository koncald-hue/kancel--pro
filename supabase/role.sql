-- =====================================================================
-- ROLE V KANCELÁŘI: vedoucí, správce, člen
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql, sdileni.sql a jmena.sql.
--
--   vedoucí (owner)  = zakladatel kanceláře: vše, včetně balíčku, názvu kanceláře a přidělování rolí. Jen jeden.
--   správce (admin)  = pozve a odebere členy (ne správce a vedoucího). Nemění název, balíček ani role.
--   člen (member)    = pracuje jen se svým profilem a svými daty.
-- Role smí udělovat a měnit jen vedoucí. Obsah cizích věcí, klientů a zpráv nevidí nikdo z nich, ani vedoucí.
-- =====================================================================

alter table public.firm_members drop constraint if exists firm_members_role_check;
alter table public.firm_members add constraint firm_members_role_check check (role in ('owner', 'admin', 'member'));

-- Oprávnění: smí uživatel spravovat členy (vedoucí a správce)?
create or replace function public.firm_can_manage(p_firm uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.firm_members where firm_id = p_firm and user_id = auth.uid() and role in ('owner', 'admin'));
$$;
revoke all on function public.firm_can_manage(uuid) from public;
grant execute on function public.firm_can_manage(uuid) to authenticated;

-- Přidělení role (jen vedoucí): správce nebo člen
create or replace function public.set_member_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms;
begin
  if p_role not in ('admin', 'member') then raise exception 'Role může být správce nebo člen.'; end if;
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role = 'owner' where m.user_id = auth.uid();
  if not found then raise exception 'Role smí přidělovat jen vedoucí kanceláře.'; end if;
  if p_user = auth.uid() then raise exception 'Svoji roli vedoucího změnit nelze.'; end if;
  update public.firm_members set role = p_role where user_id = p_user and firm_id = f.id and role <> 'owner';
  if not found then raise exception 'Člen nenalezen.'; end if;
end;
$$;
revoke all on function public.set_member_role(uuid, text) from public;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- Přejmenování kanceláře (jen vedoucí)
create or replace function public.rename_firm(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Název kanceláře musí mít 2 až 120 znaků.'; end if;
  update public.firms set name = v_name where owner_id = auth.uid();
  if not found then raise exception 'Kancelář smí přejmenovat jen vedoucí.'; end if;
end;
$$;
revoke all on function public.rename_firm(text) from public;
grant execute on function public.rename_firm(text) to authenticated;

-- Pozvánky a odebírání: vedoucí a správce (správce neodebírá vedoucího ani jiné správce)
create or replace function public.invite_firm_member(p_email text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; v_email text := lower(btrim(coalesce(p_email, ''))); v_name text := btrim(coalesce(p_name, '')); v_used integer; v_token text;
begin
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role in ('owner', 'admin') where m.user_id = auth.uid() for update of fi;
  if not found then raise exception 'Pozvánky smí posílat jen vedoucí nebo správce kanceláře.'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 then raise exception 'Zadejte jméno kolegy (alespoň 3 znaky).'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then raise exception 'Zadejte platný e-mail.'; end if;
  if f.seats <= 0 or f.until is null or f.until < current_date then raise exception 'Nejdřív pořiďte balíček pro kancelář (nebo ho obnovte).'; end if;
  if exists (select 1 from public.firm_members fm join public.lawyer_access la on la.user_id = fm.user_id where fm.firm_id = f.id and lower(la.email) = v_email) then raise exception 'Tento advokát už je členem kanceláře.'; end if;
  update public.firm_invites set revoked = true where firm_id = f.id and lower(email) = v_email and accepted_at is null and not revoked;
  select (select count(*) from public.firm_members where firm_id = f.id)
       + (select count(*) from public.firm_invites where firm_id = f.id and accepted_at is null and not revoked and expires_at > now()) into v_used;
  if v_used >= f.seats then raise exception 'Všechna místa v balíčku jsou obsazená nebo rezervovaná pozvánkou.'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.firm_invites (firm_id, email, name, token) values (f.id, v_email, v_name, v_token);
  return v_token;
end;
$$;
revoke all on function public.invite_firm_member(text, text) from public;
grant execute on function public.invite_firm_member(text, text) to authenticated;

create or replace function public.revoke_firm_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.firm_invites i set revoked = true
  where i.id = p_invite and i.accepted_at is null and public.firm_can_manage(i.firm_id);
end;
$$;
revoke all on function public.revoke_firm_invite(uuid) from public;
grant execute on function public.revoke_firm_invite(uuid) to authenticated;

create or replace function public.remove_firm_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me public.firm_members; v_target public.firm_members;
begin
  select * into v_me from public.firm_members where user_id = auth.uid() and role in ('owner', 'admin');
  if not found then raise exception 'Členy smí odebírat jen vedoucí nebo správce kanceláře.'; end if;
  select * into v_target from public.firm_members where user_id = p_user and firm_id = v_me.firm_id;
  if not found then raise exception 'Člen nenalezen.'; end if;
  if v_target.role = 'owner' or p_user = auth.uid() then raise exception 'Vedoucího kanceláře odebrat nelze.'; end if;
  if v_target.role = 'admin' and v_me.role <> 'owner' then raise exception 'Správce smí odebrat jen vedoucí.'; end if;
  delete from public.firm_members where user_id = p_user and firm_id = v_me.firm_id;
  update public.lawyer_access set status = 'expired', until = current_date - 1, firm_id = null where user_id = p_user and firm_id = v_me.firm_id;
end;
$$;
revoke all on function public.remove_firm_member(uuid) from public;
grant execute on function public.remove_firm_member(uuid) to authenticated;

-- Přehled kanceláře: moje role; vedoucí a správce vidí členy a pozvánky
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
  if m.role in ('owner', 'admin') then
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
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'name', i.name, 'token', i.token, 'expires_at', i.expires_at) order by i.created_at), '[]'::jsonb)
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

-- Kolegové (jméno, role, e-mail, zda mají zapnutý chat): vidí všichni členové
create or replace function public.firm_colleagues()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.firm_members where user_id = auth.uid();
  if v_firm is null then return null; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'name', coalesce(nullif(la.display_name, ''), la.email, ''),
      'email', coalesce(nullif(la.contact_email, ''), la.email, ''),
      'role', m.role,
      'has_keys', exists (select 1 from public.member_keys k where k.user_id = m.user_id)
    ) order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, coalesce(nullif(la.display_name, ''), la.email)), '[]'::jsonb)
    from public.firm_members m left join public.lawyer_access la on la.user_id = m.user_id
    where m.firm_id = v_firm and m.user_id <> auth.uid()
  );
end;
$$;
revoke all on function public.firm_colleagues() from public;
grant execute on function public.firm_colleagues() to authenticated;

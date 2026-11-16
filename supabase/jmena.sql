-- =====================================================================
-- LIDÉ POJMENOVANÍ JMÉNEM (pozvánky nesou jméno kolegy)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql a pozvanka-info.sql.
--
-- Vedoucí při pozvání zadá jméno kolegy. Zobrazí se u čekající pozvánky a po přijetí se uloží do profilu kolegy
-- (předvyplní se mu a může ho upravit).
-- =====================================================================

alter table public.firm_invites add column if not exists name text not null default '';

drop function if exists public.invite_firm_member(text);
create or replace function public.invite_firm_member(p_email text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; v_email text := lower(btrim(coalesce(p_email, ''))); v_name text := btrim(coalesce(p_name, '')); v_used integer; v_token text;
begin
  select fi.* into f from public.firms fi join public.firm_members m on m.firm_id = fi.id and m.role = 'owner' where m.user_id = auth.uid() for update of fi;
  if not found then raise exception 'Pozvánky smí posílat jen vedoucí kanceláře.'; end if;
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

-- Přehled kanceláře: pozvánky s jménem
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

-- Informace o pozvánce: kancelář, jméno pozvaného a zkrácený e-mail
create or replace function public.firm_invite_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'firm', f.name, 'name', i.name,
    'email_hint', left(split_part(i.email, '@', 1), 1) || '***@' || split_part(i.email, '@', 2)
  )
  from public.firm_invites i join public.firms f on f.id = i.firm_id
  where i.token = coalesce(p_token, '') and not i.revoked and i.accepted_at is null and i.expires_at > now();
$$;
revoke all on function public.firm_invite_info(text) from public;
grant execute on function public.firm_invite_info(text) to anon, authenticated;

-- Přijetí pozvánky: jméno z pozvánky se uloží do profilu, pokud tam ještě žádné není
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
  insert into public.lawyer_access (user_id, email, status, until, firm_id, display_name) values (auth.uid(), v_email, 'active', f.until, f.id, i.name)
  on conflict (user_id) do update set status = 'active', until = f.until, firm_id = f.id
  where public.lawyer_access.status <> 'active' or public.lawyer_access.until is null or public.lawyer_access.until < f.until;
  update public.lawyer_access set display_name = i.name where user_id = auth.uid() and btrim(coalesce(display_name, '')) = '';
  return f.name;
end;
$$;
revoke all on function public.accept_firm_invite(text) from public;
grant execute on function public.accept_firm_invite(text) to authenticated;

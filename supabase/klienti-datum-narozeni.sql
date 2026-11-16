-- =====================================================================
-- DATUM NAROZENÍ KLIENTA A HLÍDÁNÍ FYZICKÝCH OSOB V INSOLVENCI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné insolvence-klienti.sql.
--
-- Klient může mít datum narození (nepovinné). Klient s IČO se hlídá jako firma, klient bez IČO, ale s datem narození
-- a jménem a příjmením, se hlídá jako fyzická osoba (rejstřík fyzickou osobu hledá podle jména, příjmení a data narození).
-- =====================================================================
alter table public.lawyer_clients add column if not exists birth date check (birth is null or (birth >= date '1900-01-01' and birth <= current_date));

-- Rozdělení jména „JUDr. Jan Karel Novák, Ph.D.“ na jméno (první slovo) a příjmení (poslední slovo), tituly se vynechají
create or replace function public.split_person_name(p_name text)
returns table (first_name text, last_name text)
language sql
immutable
as $$
  with cleaned as (
    select regexp_split_to_array(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '(^|\s)(JUDr|Mgr|Ing|Bc|MUDr|PhDr|RNDr|MVDr|Doc|Prof|Dr|Ph\.?D|CSc|MBA|DiS|LL\.?M|Bc|BcA|MgA|Arch)\.?(?=\s|,|$)', ' ', 'gi'), '[,;]', ' ', 'g')), '\s+') as parts
  )
  select case when array_length(parts, 1) >= 2 then parts[1] else null end,
         case when array_length(parts, 1) >= 2 then parts[array_length(parts, 1)] else null end
  from cleaned;
$$;

create or replace function public.sync_client_watches(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer := 0; m integer := 0;
begin
  if p_user is null then return 0; end if;
  if auth.uid() is not null and auth.uid() <> p_user then raise exception 'Nedostatečná oprávnění.'; end if;
  if not public.has_isir(p_user) then return 0; end if;

  -- zrušení automatických hlídání, která už klientovi nepatří (změna IČO, data narození nebo jména)
  delete from public.isir_watches w using public.lawyer_clients c
    where w.client_id = c.id and w.auto and w.user_id = p_user and (
      (w.kind = 'firma' and c.ico !~ '^[0-9]{8}$')
      or (w.kind = 'osoba' and (c.ico ~ '^[0-9]{8}$' or c.birth is null or (select last_name from public.split_person_name(c.name)) is null)));
  update public.isir_watches w set label = left(c.name, 160), ic = c.ico
    from public.lawyer_clients c
    where w.client_id = c.id and w.auto and w.kind = 'firma' and w.user_id = p_user and c.ico ~ '^[0-9]{8}$' and (w.label is distinct from left(c.name, 160) or w.ic is distinct from c.ico);
  update public.isir_watches w set label = left(c.name, 160), name = s.last_name, first_name = s.first_name, birth = c.birth
    from public.lawyer_clients c, lateral public.split_person_name(c.name) s
    where w.client_id = c.id and w.auto and w.kind = 'osoba' and w.user_id = p_user and c.birth is not null and s.last_name is not null
      and (w.name is distinct from s.last_name or w.first_name is distinct from s.first_name or w.birth is distinct from c.birth or w.label is distinct from left(c.name, 160));

  insert into public.isir_watches (user_id, label, kind, ic, client_id, auto)
    select c.user_id, left(c.name, 160), 'firma', c.ico, c.id, true
    from public.lawyer_clients c
    where c.user_id = p_user and c.ico ~ '^[0-9]{8}$'
      and not exists (select 1 from public.isir_watches w where w.user_id = p_user and w.kind = 'firma' and w.ic = c.ico);
  get diagnostics n = row_count;

  insert into public.isir_watches (user_id, label, kind, name, first_name, birth, client_id, auto)
    select c.user_id, left(c.name, 160), 'osoba', s.last_name, s.first_name, c.birth, c.id, true
    from public.lawyer_clients c, lateral public.split_person_name(c.name) s
    where c.user_id = p_user and c.ico !~ '^[0-9]{8}$' and c.birth is not null and s.last_name is not null and char_length(s.last_name) >= 2 and char_length(s.first_name) >= 2
      and not exists (select 1 from public.isir_watches w where w.user_id = p_user and w.kind = 'osoba' and (w.client_id = c.id or (lower(w.name) = lower(s.last_name) and lower(w.first_name) = lower(s.first_name) and w.birth = c.birth)));
  get diagnostics m = row_count;
  return n + m;
end;
$$;
revoke all on function public.sync_client_watches(uuid) from public;
grant execute on function public.sync_client_watches(uuid) to authenticated, service_role;

-- Po změně klienta se synchronizuje hned (stačí zavolat celou synchronizaci, klientů jednoho uživatele bývá málo)
create or replace function public.client_watch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_isir(new.user_id) then perform public.sync_client_watches(new.user_id); end if;
  return new;
end;
$$;
drop trigger if exists lawyer_clients_isir on public.lawyer_clients;
create trigger lawyer_clients_isir after insert or update of ico, name, birth on public.lawyer_clients for each row execute function public.client_watch_trigger();

-- Stav pro seznam klientů: firmy podle IČO, fyzické osoby podle automatického hlídání klienta
create or replace function public.client_insolvency_status()
returns table (client_id uuid, ic text, watched boolean, last_checked_at timestamptz, last_error text, active_count integer, ended_count integer, spis text, state text, url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.ico, wi.ids is not null, wi.lc, coalesce(wi.le, ''),
         coalesce(hh.active, 0), coalesce(hh.ended, 0), hh.spis, hh.state, hh.url
  from public.lawyer_clients c
  left join lateral (
    select max(w.last_checked_at) as lc, max(w.last_error) as le, array_agg(w.id) as ids
    from public.isir_watches w
    where w.user_id = auth.uid() and ((w.kind = 'firma' and c.ico ~ '^[0-9]{8}$' and w.ic = c.ico) or (w.client_id = c.id and w.auto))
  ) wi on true
  left join lateral (
    select count(distinct h.spis) filter (where h.ended is null)::integer as active,
           count(distinct h.spis) filter (where h.ended is not null)::integer as ended,
           (array_agg(h.spis order by h.started desc nulls last) filter (where h.ended is null))[1] as spis,
           (array_agg(h.state order by h.started desc nulls last) filter (where h.ended is null))[1] as state,
           (array_agg(h.url order by h.started desc nulls last) filter (where h.ended is null))[1] as url
    from public.isir_hits h where wi.ids is not null and h.watch_id = any(wi.ids)
  ) hh on true
  where c.user_id = auth.uid();
$$;
revoke all on function public.client_insolvency_status() from public;
grant execute on function public.client_insolvency_status() to authenticated;

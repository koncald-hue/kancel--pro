-- =====================================================================
-- 20261118_18  STŘET ZÁJMŮ: SKLOŇOVÁNÍ I U KRÁTKÝCH JMEN (spouštět po 20261118_17)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Pětipísmenná slova („Petru“, „Janem“) se dosud nezkracovala, takže „Petru Dvořákovi“ nenašlo „Petr Dvořák“.
-- Teď se koncovka odebírá u slov od pěti znaků (zbydou aspoň čtyři). Výstup se nemění.
-- =====================================================================

create or replace function public.conflict_firm_check(p_names text[], p_icos text[])
returns table (term text, kind text, n bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_firm uuid;
begin
  if auth.uid() is null or not public.mfa_ok() or not public.has_lawyer_access() then return; end if;
  select m.firm_id into v_firm from public.firm_members m where m.user_id = auth.uid();
  if v_firm is null then return; end if;
  if coalesce(array_length(p_names, 1), 0) > 10 or coalesce(array_length(p_icos, 1), 0) > 10 then return; end if;

  return query
    with colleagues as (select user_id from public.firm_members where firm_id = v_firm and user_id <> auth.uid()),
    raw as (select distinct left(t, 200) as raw from unnest(coalesce(p_names, '{}')) t where char_length(btrim(t)) >= 3),
    words as (
      select r.raw, case when char_length(w) > 4 then left(w, greatest(4, char_length(w) - 3)) else w end as st
        from raw r, regexp_split_to_table(regexp_replace(public.norm(r.raw), '[^a-z0-9]+', ' ', 'g'), ' ') w
       where char_length(w) >= 3 and w not in ('judr', 'mgr', 'ing', 'phd', 'mudr', 'spol', 'sro', 'pan', 'pani')
    ),
    usable as (select raw from words group by raw having max(char_length(st)) >= 4),
    icos as (select t as raw, regexp_replace(t, '\D', '', 'g') as ico from unnest(coalesce(p_icos, '{}')) t where char_length(regexp_replace(t, '\D', '', 'g')) >= 6)
    select u.raw, 'klient'::text, count(distinct c.id)
      from usable u join public.lawyer_clients c on c.user_id in (select user_id from colleagues)
     where not exists (select 1 from words w where w.raw = u.raw and position(w.st in public.norm(c.name)) = 0)
     group by u.raw
    union all
    select i.raw, 'klient'::text, count(distinct c.id)
      from icos i join public.lawyer_clients c on c.user_id in (select user_id from colleagues) and regexp_replace(coalesce(c.ico, ''), '\D', '', 'g') = i.ico
     group by i.raw
    union all
    select u.raw, 'protistrana'::text, count(distinct k.id)
      from usable u join public.case_contacts k on k.user_id in (select user_id from colleagues) and position('protistr' in public.norm(k.role)) > 0
     where not exists (select 1 from words w where w.raw = u.raw and position(w.st in public.norm(k.name)) = 0)
     group by u.raw;
end; $$;
revoke all on function public.conflict_firm_check(text[], text[]) from public, anon;
grant execute on function public.conflict_firm_check(text[], text[]) to authenticated;

insert into public.schema_migrations (name) values ('20261118_18_stret-zajmu-kratka-jmena') on conflict do nothing;

-- =====================================================================
-- 20261118_13  KONTROLA STŘETU ZÁJMŮ NAPŘÍČ KANCELÁŘÍ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: firms.sql (firm_members), lawyer.sql (lawyer_clients), hledani.sql (norm), 20261118_05 (mfa_ok).
--
-- Střet zájmů se u kanceláře s více advokáty posuzuje za celou kancelář, ne za jednoho člověka. Funkce proto
-- porovná zadaná jména a IČO s klienty a protistranami KOLEGŮ ve stejné kanceláři. Vrací jen to, ŽE shoda existuje
-- a v jaké roli (klient / protistrana), a kolik jich je. Nikdy nevrací jméno kolegy, věc, popis ani jiný obsah.
-- Člověk bez kanceláře dostane prázdný výsledek.
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
    terms as (
      select public.norm(t) as nt, t as raw, 'name' as via from unnest(coalesce(p_names, '{}')) t where char_length(trim(t)) >= 4
      union all
      select regexp_replace(t, '\D', '', 'g'), t, 'ico' from unnest(coalesce(p_icos, '{}')) t where char_length(regexp_replace(t, '\D', '', 'g')) >= 6
    )
    select t.raw, 'klient'::text, count(*)
      from terms t join public.lawyer_clients c on c.user_id in (select user_id from colleagues)
       and ((t.via = 'name' and position(t.nt in public.norm(c.name)) > 0) or (t.via = 'ico' and regexp_replace(coalesce(c.ico, ''), '\D', '', 'g') = t.nt))
     group by t.raw
    union all
    select t.raw, 'protistrana'::text, count(*)
      from terms t join public.case_contacts k on k.user_id in (select user_id from colleagues)
       and position('protistr' in public.norm(k.role)) > 0
       and t.via = 'name' and position(t.nt in public.norm(k.name)) > 0
     group by t.raw;
end; $$;
revoke all on function public.conflict_firm_check(text[], text[]) from public, anon;
grant execute on function public.conflict_firm_check(text[], text[]) to authenticated;

insert into public.schema_migrations (name) values ('20261118_13_stret-zajmu-v-kancelari') on conflict do nothing;

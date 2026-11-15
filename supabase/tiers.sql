-- =====================================================================
-- OMEZENÍ BEZPLATNÝCH ÚČTŮ (běžní uživatelé vs. advokáti)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné cases.sql, case-files.sql a lawyer.sql.
--
-- Bezplatný účet: nejvýše 3 případy, 10 souborů a 25 MB na případ, 3 složky a 5 kontaktů na případ.
-- Advokát (aktivní nebo zkušební přístup) a člen týmu limity nemá. Omezuje se jen přidávání nových
-- záznamů; co už uživatel má, zůstává.
-- =====================================================================

create or replace function public.lawyer_tier_for(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = p_user)
      or exists (
        select 1 from public.lawyer_access
        where user_id = p_user
          and status in ('active', 'trial')
          and (until is null or until >= current_date)
      );
$$;
revoke all on function public.lawyer_tier_for(uuid) from public;

create or replace function public.enforce_free_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer; v_bytes bigint;
begin
  if public.lawyer_tier_for(new.user_id) then return new; end if;

  if tg_table_name = 'cases' then
    select count(*) into v_count from public.cases where user_id = new.user_id;
    if v_count >= 3 then raise exception 'Bezplatný účet umožňuje 3 případy. Neomezené spisy jsou v balíčku pro advokáty.'; end if;
  elsif tg_table_name = 'case_files' then
    select count(*), coalesce(sum(size), 0) into v_count, v_bytes from public.case_files where case_id = new.case_id;
    if v_count >= 10 then raise exception 'Bezplatný účet umožňuje 10 souborů na případ.'; end if;
    if v_bytes + new.size > 26214400 then raise exception 'Bezplatný účet umožňuje 25 MB souborů na případ.'; end if;
  elsif tg_table_name = 'case_folders' then
    select count(*) into v_count from public.case_folders where case_id = new.case_id;
    if v_count >= 3 then raise exception 'Bezplatný účet umožňuje 3 složky na případ.'; end if;
  elsif tg_table_name = 'case_contacts' then
    select count(*) into v_count from public.case_contacts where case_id = new.case_id;
    if v_count >= 5 then raise exception 'Bezplatný účet umožňuje 5 kontaktů na případ.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists free_limits_cases on public.cases;
create trigger free_limits_cases before insert on public.cases for each row execute function public.enforce_free_limits();
drop trigger if exists free_limits_files on public.case_files;
create trigger free_limits_files before insert on public.case_files for each row execute function public.enforce_free_limits();
drop trigger if exists free_limits_folders on public.case_folders;
create trigger free_limits_folders before insert on public.case_folders for each row execute function public.enforce_free_limits();
drop trigger if exists free_limits_contacts on public.case_contacts;
create trigger free_limits_contacts before insert on public.case_contacts for each row execute function public.enforce_free_limits();

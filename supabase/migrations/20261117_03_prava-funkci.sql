-- =====================================================================
-- 20261117_03  PRÁVA K DATABÁZOVÝM FUNKCÍM
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: zruseni-a-zamek.sql, security-hardening.sql, 20261117_01.
--
-- Co uzavírá (ověřeno testem s veřejným anon klíčem 17. 11. 2026):
--  1) Supabase dává roli anon právo spouštět funkce ve schématu public, i když skript udělal
--     „revoke … from public“. Nepřihlášený návštěvník tak mohl volat např. has_lawyer_access(<id uživatele>)
--     a zjistit, zda má kdokoli aktivní předplatné. Níže se anon odebere spouštění funkcí, které dávají smysl
--     jen přihlášenému uživateli. Funkce potřebné bez přihlášení (ceníky, informace o pozvánce, is_staff) zůstávají.
--  2) has_lawyer_access(p_user) odpoví o JINÉM uživateli jen serveru (service role) nebo provozovateli.
--     Přihlášený uživatel se tak už nemůže ptát na předplatné cizích účtů.
-- Data se nemění.
-- =====================================================================

create or replace function public.has_lawyer_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is distinct from auth.uid()
         and coalesce(auth.role(), '') <> 'service_role'
         and not coalesce(public.is_staff(), false) then false
    else coalesce(public.is_staff(), false)
      or exists (select 1 from public.lawyer_access la where la.user_id = p_user and la.status in ('active', 'trial') and (la.until is null or la.until >= current_date))
  end;
$$;
revoke all on function public.has_lawyer_access(uuid) from public, anon;
grant execute on function public.has_lawyer_access(uuid) to authenticated, service_role;

-- Funkce jen pro přihlášené: anon je nesmí spouštět (všechny přetížené varianty, pokud existují)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any (array[
         'case_access', 'can_read_case', 'can_write_case', 'same_firm', 'case_share_info', 'case_people',
         'firm_overview', 'firm_colleagues', 'colleague_profile', 'chat_summary', 'my_nudges', 'mark_chat_read',
         'dismiss_nudges', 'nudge_colleague', 'search_all', 'client_insolvency_status', 'has_isir', 'isir_status',
         'sync_client_watches', 'admin_stats', 'issue_invoice', 'save_billing_settings', 'set_intake_code',
         'save_lawyer_profile', 'update_lawyer_profile', 'save_avatar', 'remove_avatar', 'create_firm', 'rename_firm',
         'invite_firm_member', 'revoke_firm_invite', 'remove_firm_member', 'set_member_role', 'leave_firm',
         'accept_firm_invite', 'create_lawyer_order', 'create_firm_order', 'create_isir_order',
         'staff_cancel_firm_package', 'staff_confirm_isir_order', 'staff_grant_firm_package', 'staff_grant_isir',
         'staff_mark_order_paid', 'apply_lawyer_payment'
       ])
  loop
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;
end $$;

insert into public.schema_migrations (name) values ('20261117_03_prava-funkci') on conflict do nothing;

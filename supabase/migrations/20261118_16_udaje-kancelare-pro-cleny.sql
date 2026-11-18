-- =====================================================================
-- 20261118_16  ÚDAJE KANCELÁŘE JSOU SPOLEČNÉ, ÚČET MÁ KAŽDÝ ADVOKÁT SVŮJ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: firms.sql (firm_members), fakturace.sql (sloupce lawyer_access), 20261117_01 (schema_migrations).
--
-- Společné pro celou kancelář (spravuje vedoucí, členové je dostanou): název na dokladech, IČO, DIČ, plátce DPH,
-- splatnost a poznámka na fakturách. Každý advokát má vlastní: číslo účtu (a tím i QR platbu) a hodinovou sazbu.
-- Společné údaje se členovi nastaví:
--   1) jednorázově hned pro všechny stávající členy,
--   2) když se k nějaké kanceláři připojí (nastaví se mu firm_id),
--   3) kdykoli je vedoucí změní (členům se přepíšou na stejnou hodnotu).
-- Číslo účtu ani sazbu člena tato migrace nikdy nemění.
-- =====================================================================

create or replace function public.inherit_firm_billing(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.lawyer_access;
begin
  select la.* into o
    from public.lawyer_access me
    join public.firm_members fo on fo.firm_id = me.firm_id and fo.role = 'owner'
    join public.lawyer_access la on la.user_id = fo.user_id
   where me.user_id = p_user and la.user_id <> p_user;
  if not found then return; end if;
  update public.lawyer_access m set firm_name = o.firm_name, ico = o.ico, dic = o.dic, vat_payer = o.vat_payer, due_days = o.due_days, invoice_note = o.invoice_note
   where m.user_id = p_user
     and (m.firm_name, m.ico, m.dic, m.vat_payer, m.due_days, m.invoice_note) is distinct from (o.firm_name, o.ico, o.dic, o.vat_payer, o.due_days, o.invoice_note);
end; $$;
revoke all on function public.inherit_firm_billing(uuid) from public, anon, authenticated;

-- Člen se připojil k kanceláři
create or replace function public.lawyer_access_inherit_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.firm_id is not null then perform public.inherit_firm_billing(new.user_id); end if;
  return null;
end; $$;
drop trigger if exists lawyer_access_inherit on public.lawyer_access;
create trigger lawyer_access_inherit after insert or update of firm_id on public.lawyer_access for each row when (new.firm_id is not null) execute function public.lawyer_access_inherit_trg();

-- Vedoucí změnil společné údaje: propsat je všem členům
create or replace function public.lawyer_access_owner_sync_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if exists (select 1 from public.firm_members where user_id = new.user_id and role = 'owner') then
    for r in select la.user_id from public.firm_members fm join public.lawyer_access la on la.user_id = fm.user_id
              where fm.firm_id = (select firm_id from public.firm_members where user_id = new.user_id) and fm.user_id <> new.user_id loop
      perform public.inherit_firm_billing(r.user_id);
    end loop;
  end if;
  return null;
end; $$;
drop trigger if exists lawyer_access_owner_sync on public.lawyer_access;
create trigger lawyer_access_owner_sync after update of firm_name, ico, dic, vat_payer, due_days, invoice_note on public.lawyer_access for each row execute function public.lawyer_access_owner_sync_trg();

-- Jednorázově pro stávající členy
do $$ declare r record; begin
  for r in select user_id from public.lawyer_access where firm_id is not null loop perform public.inherit_firm_billing(r.user_id); end loop;
end $$;

insert into public.schema_migrations (name) values ('20261118_16_udaje-kancelare-pro-cleny') on conflict do nothing;

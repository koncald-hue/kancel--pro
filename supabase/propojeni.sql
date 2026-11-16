-- =====================================================================
-- PROPOJENÍ ÚDAJŮ MEZI PANELY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné fakturace.sql.
--
-- 1) Změna jména, e-mailu nebo telefonu klienta se propíše do všech jeho věcí (dřív zůstalo ve věcech staré jméno).
-- 2) Stornované vyúčtování uvolní svoje výkazy práce zpět k vyfakturování (dřív zůstaly označené jako vyfakturované).
-- =====================================================================

create or replace function public.propagate_client_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name or new.email is distinct from old.email or new.phone is distinct from old.phone then
    update public.cases set
      client_name = new.name,
      client_email = case when btrim(new.email) <> '' then new.email else client_email end,
      client_phone = case when btrim(new.phone) <> '' then new.phone else client_phone end
    where client_id = new.id and user_id = new.user_id
      and (client_name is distinct from new.name or client_email is distinct from new.email or client_phone is distinct from new.phone);
  end if;
  return new;
end;
$$;
drop trigger if exists lawyer_clients_propagate on public.lawyer_clients;
create trigger lawyer_clients_propagate after update of name, email, phone on public.lawyer_clients for each row execute function public.propagate_client_change();

create or replace function public.unbill_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.time_entries set billed = false
    where user_id = new.user_id and id in (select time_entry_id from public.invoice_lines where invoice_id = new.id and time_entry_id is not null);
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_unbill_on_cancel on public.invoices;
create trigger invoices_unbill_on_cancel after update of status on public.invoices for each row execute function public.unbill_on_cancel();

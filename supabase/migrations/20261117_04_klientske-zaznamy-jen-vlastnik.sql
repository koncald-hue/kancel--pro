-- =====================================================================
-- 20261117_04  KLIENTSKÉ ZÁZNAMY SMÍ VYTVÁŘET JEN VLASTNÍK VĚCI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: client-portal.sql, podpisy-a-aml.sql, sdilene-veci.sql, 20261117_01.
--
-- Chyba, kterou to opravuje (nalezena testem sdílení věcí 17. 11. 2026):
--  Politiky u client_links, client_requests, client_messages, signature_requests a client_identifications
--  kontrolovaly jen „user_id = přihlášený“, ne to, komu věc (case_id) patří. Každý přihlášený advokát, který znal
--  číslo cizí věci (např. kolega u sdílené věci, i jen čtenář, nebo bývalý kolega), mohl k ní založit klientský odkaz,
--  žádost o podpis, požadavek nebo zprávu. Klientská stránka čte věc podle case_id serverovým klíčem, takže by se
--  takový záznam klientovi zobrazil jako od jeho advokáta.
--
-- Oprava (v databázi, ne v aplikaci):
--  1) Tyto záznamy lze vložit nebo přesunout jen do věci, kterou přihlášený uživatel VLASTNÍ.
--  2) Čas, faktura, nemovitost a stopa práce lze navázat jen na věc, kterou uživatel smí číst.
--  3) Příznak „viditelné pro klienta“ u souborů, chronologie a lhůt smí měnit jen vlastník věci
--     (kolega-editor dál soubory, lhůty a chronologii upravuje, jen je nesmí vystavit klientovi).
-- Serverové operace (service role, SQL editor) se tím neblokují. Existující data se nemění.
-- =====================================================================

create or replace function public.guard_owner_only_case_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then return new; end if;
  select c.user_id into v_owner from public.cases c where c.id = new.case_id;
  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'Klientské záznamy (odkaz, požadavky, zprávy, podpisy, identifikace) smí u věci vytvářet jen její vlastník.';
  end if;
  return new;
end; $$;
revoke all on function public.guard_owner_only_case_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['client_links', 'client_requests', 'client_messages', 'signature_requests', 'client_identifications'] loop
    execute format('drop trigger if exists guard_owner_only_case_row on public.%I', t);
    execute format('create trigger guard_owner_only_case_row before insert or update of case_id on public.%I for each row execute function public.guard_owner_only_case_row()', t);
  end loop;
end $$;

-- Záznamy, které smí zakládat kdokoli ze svých věcí (čas, faktura, nemovitost, stopa práce), ale jen k věci, kterou může číst
-- (vlastní, nebo sdílená). Bez toho šlo zapsat čas nebo fakturu k věci uživatele z úplně jiné kanceláře.
create or replace function public.guard_case_readable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.case_id is null then return new; end if;
  if not public.can_read_case(new.case_id) then
    raise exception 'K této věci nemáte přístup.';
  end if;
  return new;
end; $$;
revoke all on function public.guard_case_readable() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['time_entries', 'invoices', 'case_properties', 'work_activity'] loop
    execute format('drop trigger if exists guard_case_readable on public.%I', t);
    execute format('create trigger guard_case_readable before insert or update of case_id on public.%I for each row execute function public.guard_case_readable()', t);
  end loop;
end $$;

create or replace function public.guard_client_visible()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (tg_op = 'INSERT' and new.client_visible) or (tg_op = 'UPDATE' and new.client_visible is distinct from old.client_visible) then
    if not exists (select 1 from public.cases c where c.id = new.case_id and c.user_id = auth.uid()) then
      raise exception 'Zpřístupnit klientovi smí jen vlastník věci.';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.guard_client_visible() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['case_files', 'case_entries', 'case_deadlines'] loop
    execute format('drop trigger if exists guard_client_visible on public.%I', t);
    execute format('create trigger guard_client_visible before insert or update on public.%I for each row execute function public.guard_client_visible()', t);
  end loop;
end $$;

insert into public.schema_migrations (name) values ('20261117_04_klientske-zaznamy-jen-vlastnik') on conflict do nothing;

-- =====================================================================
-- ZRUŠENÍ BALÍČKU KANCELÁŘE A REŽIM JEN PRO ČTENÍ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql, role.sql a testovaci-balicek.sql.
--
-- 1) Když advokátovi (nebo celé kanceláři) skončí nebo se zruší předplatné, data zůstanou ke čtení,
--    ale databáze odmítne jakýkoli zápis (nová věc, úprava, nahrání souboru, zpráva, faktura...).
--    Zámek je v databázi, takže ho nejde obejít úpravou stránky. Platby a profil zůstávají dostupné.
-- 2) Provozovatel může balíček kanceláře zrušit okamžitě (staff_cancel_firm_package).
-- =====================================================================

-- Má uživatel platný (aktivní nebo zkušební, nevypršelý) přístup, nebo je členem týmu?
create or replace function public.has_lawyer_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_staff(), false)
    or exists (select 1 from public.lawyer_access la where la.user_id = p_user and la.status in ('active', 'trial') and (la.until is null or la.until >= current_date));
$$;
revoke all on function public.has_lawyer_access(uuid) from public;
grant execute on function public.has_lawyer_access(uuid) to authenticated;

-- Spouštěč: zápis do dat advokáta bez platného přístupu skončí srozumitelnou chybou.
-- Zápisy bez přihlášeného uživatele (klientský odkaz, platební brána) se neblokují, ty mají vlastní kontroly.
-- Výjimka: označení zprávy za přečtenou.
create or replace function public.block_when_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if auth.uid() is null or public.has_lawyer_access(auth.uid()) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'read_at' - 'read') = (to_jsonb(old) - 'read_at' - 'read') then return new; end if;
  raise exception 'Přístup je zamčený: předplatné skončilo nebo bylo zrušeno. Data si můžete prohlížet, funkce se odemknou po zaplacení předplatného.' using errcode = 'P0001';
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['cases','case_contacts','case_deadlines','case_entries','case_files','case_folders','case_law','case_properties',
    'client_links','client_messages','client_requests','firm_messages','firm_message_files','firm_shares','chat_nudges',
    'inquiry_files','invoices','invoice_lines','invoice_payments','lawyer_clients','lawyer_inquiries','lawyer_templates','price_items','time_entries']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists lock_when_expired on public.%I', t);
      execute format('create trigger lock_when_expired before insert or update or delete on public.%I for each row execute function public.block_when_locked()', t);
    end if;
  end loop;
end $$;

-- Úložiště souborů: čtení zůstává, nahrávání a mazání se bez přístupu zamkne
drop policy if exists "lock: insert" on storage.objects;
create policy "lock: insert" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('case-files', 'firm-shares', 'inquiry-files') or public.has_lawyer_access(auth.uid()));
drop policy if exists "lock: update" on storage.objects;
create policy "lock: update" on storage.objects as restrictive for update to authenticated
  using (bucket_id not in ('case-files', 'firm-shares', 'inquiry-files') or public.has_lawyer_access(auth.uid()));
drop policy if exists "lock: delete" on storage.objects;
create policy "lock: delete" on storage.objects as restrictive for delete to authenticated
  using (bucket_id not in ('case-files', 'firm-shares', 'inquiry-files') or public.has_lawyer_access(auth.uid()));

-- Okamžité zrušení balíčku kanceláře provozovatelem: všem členům končí přístup hned, data zůstávají ke čtení
create or replace function public.staff_cancel_firm_package(p_firm uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare f public.firms; n integer;
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  select * into f from public.firms where id = p_firm;
  if not found then raise exception 'Kancelář neexistuje.'; end if;
  update public.firms set until = current_date - 1, seats = 0 where id = f.id;
  update public.firm_invites set revoked = true where firm_id = f.id and accepted_at is null;
  update public.lawyer_access set status = 'expired', until = current_date - 1 where firm_id = f.id;
  get diagnostics n = row_count;
  return format('Balíček kanceláře „%s“ je zrušený. Přístup ztratilo %s členů, jejich data zůstávají ke čtení.', f.name, n);
end;
$$;
revoke all on function public.staff_cancel_firm_package(uuid) from public;
grant execute on function public.staff_cancel_firm_package(uuid) to authenticated;

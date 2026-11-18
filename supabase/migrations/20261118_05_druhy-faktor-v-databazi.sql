-- =====================================================================
-- 20261118_05  DRUHÝ FAKTOR (TOTP) VYNUCENÝ V DATABÁZI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklad: v Supabase je zapnuté Authentication -> Multi-Factor -> TOTP (výchozí u nových projektů).
--
-- Co dělá: pokud má uživatel ověřený druhý faktor, databáze mu vydá data jen v relaci úrovně aal2 (heslo + kód).
-- Kdo si druhý faktor nezapnul, nepozná žádnou změnu. Neomezuje to server (service role) ani SQL editor.
-- Vynuceno restriktivními politikami RLS (platí vedle stávajících, nic z nich neruší) na datech věcí, klientů, peněz,
-- přístupů k poště a datovkám a na úložišti souborů. Tabulky lawyer_access a firms zůstávají čitelné, aby šlo po
-- přihlášení heslem zobrazit výzvu ke kódu a stav účtu.
-- Vypnutí pro konkrétního uživatele (ztracený telefon): provozovatel odebere jeho faktor v Supabase
-- (Authentication -> Users -> uživatel -> Factors) a doloží si totožnost jinou cestou.
-- =====================================================================

create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'cases', 'case_files', 'case_entries', 'case_deadlines', 'case_contacts', 'case_folders', 'case_research', 'case_properties',
    'case_law', 'case_data_messages', 'case_members', 'client_links', 'client_requests', 'client_messages', 'client_identifications',
    'signature_requests', 'lawyer_clients', 'lawyer_inquiries', 'inquiry_files', 'time_entries', 'invoices', 'invoice_lines',
    'invoice_payments', 'invoice_reminders', 'bank_accounts', 'bank_transactions', 'isds_accounts', 'mail_accounts',
    'google_connections', 'google_calendar_sync', 'import_batches', 'work_activity', 'firm_messages', 'firm_message_files',
    'firm_shares', 'member_keys', 'calendar_feeds', 'lawyer_templates', 'price_items', 'radar_events', 'radar_snapshots',
    'isir_watches', 'isir_hits', 'isir_orders', 'legal_connections', 'data_message_checks', 'verification_docs', 'audit_log'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "mfa_guard" on public.%I', t);
      execute format('create policy "mfa_guard" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
    end if;
  end loop;
end $$;

-- Úložiště souborů (věci, přílohy, chat kanceláře, doklady, poptávky)
drop policy if exists "mfa_guard_storage" on storage.objects;
create policy "mfa_guard_storage" on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('case-files', 'firm-shares', 'inquiry-files', 'verification-docs') or (select public.mfa_ok()))
  with check (bucket_id not in ('case-files', 'firm-shares', 'inquiry-files', 'verification-docs') or (select public.mfa_ok()));

insert into public.schema_migrations (name) values ('20261118_05_druhy-faktor-v-databazi') on conflict do nothing;

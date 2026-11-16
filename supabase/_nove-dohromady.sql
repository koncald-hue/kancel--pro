-- Souhrn nových SQL souborů v pořadí spuštění (každý jde spustit opakovaně): podpisy-kod-od-advokata, podpisy-email, import, vzory, sdilene-veci, posta.
-- Předpoklad: už běžely podpisy-a-aml.sql, zruseni-a-zamek.sql, sdileni.sql a ostatní starší soubory.

-- Podpis bez placené SMS brány: kód klientovi sdělí advokát (telefonicky nebo osobně).
-- Spusť JEDNOU v Supabase SQL Editoru (po podpisy-a-aml.sql). Jde spustit i opakovaně.
alter table public.signature_otps add column if not exists channel text not null default 'sms' check (channel in ('sms', 'lawyer'));
-- Podpis s kódem na e-mail (bez placené SMS brány). Spusť JEDNOU v Supabase SQL Editoru po podpisy-a-aml.sql a podpisy-kod-od-advokata.sql.
alter table public.signature_requests add column if not exists signer_email text not null default '' check (char_length(signer_email) <= 160);
alter table public.signature_otps drop constraint if exists signature_otps_channel_check;
alter table public.signature_otps add constraint signature_otps_channel_check check (channel in ('sms', 'lawyer', 'email'));
-- =====================================================================
-- IMPORT DAT (klienti, věci, lhůty, kontakty, čas) A JEHO VRÁCENÍ ZPĚT
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné lawyer.sql, case-files.sql, fakturace.sql a zruseni-a-zamek.sql.
-- Každý import je „dávka“; záznamy z dávky mají import_batch, takže jdou jedním krokem smazat.
-- =====================================================================
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('klienti', 'veci', 'lhuty', 'kontakty', 'cas')),
  source text not null default '' check (char_length(source) <= 200),
  counts jsonb not null default '{}'::jsonb,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.import_batches enable row level security;
drop policy if exists "import_batches_own" on public.import_batches;
create policy "import_batches_own" on public.import_batches for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['lawyer_clients', 'cases', 'case_deadlines', 'case_contacts', 'time_entries'] loop
    execute format('alter table public.%I add column if not exists import_batch uuid references public.import_batches(id) on delete set null', t);
    execute format('create index if not exists %I on public.%I (import_batch) where import_batch is not null', t || '_import_idx', t);
  end loop;
  execute 'drop trigger if exists lock_when_expired on public.import_batches';
  execute 'create trigger lock_when_expired before insert or update or delete on public.import_batches for each row execute function public.block_when_locked()';
end $$;
-- Základní sada vzorů: u vzoru se uchová jeho původ a poznámka „Co zkontrolovat před použitím“.
-- Spusť JEDNOU v Supabase SQL Editoru po poptavky-prilohy.sql. Jde spustit i opakovaně.
alter table public.lawyer_templates add column if not exists starter_id text;
alter table public.lawyer_templates add column if not exists note text not null default '' check (char_length(note) <= 2000);
create index if not exists lawyer_templates_starter_idx on public.lawyer_templates (user_id, starter_id) where starter_id is not null;
-- =====================================================================
-- SDÍLENÉ VĚCI V KANCELÁŘI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné cases.sql, case-files.sql, case-meta.sql, sdileni.sql (same_firm) a zruseni-a-zamek.sql.
--
-- Věc patří jednomu advokátovi (vlastníkovi). Ten ji může nasdílet kolegům ze své kanceláře jako „editor“ (čte i upravuje)
-- nebo „čtenář“ (jen čte). Kolega sdílenou věc vidí v seznamu věcí, pracuje se soubory, lhůtami, chronologií a kontakty.
-- Klientská stránka, podpisy, identifikace, výkazy a vyúčtování zůstávají jen u vlastníka.
-- Přístup kolegy zaniká, jakmile opustí kancelář nebo je odebrán ze sdílení.
-- Šifrovaná komunikace s klientem: klíč kanálu lze zabalit veřejným klíčem kolegy (case_members.wrapped_key).
-- =====================================================================
create table if not exists public.case_members (
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  wrapped_key text check (wrapped_key is null or char_length(wrapped_key) < 4000),
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);
create index if not exists case_members_user_idx on public.case_members (user_id);
alter table public.case_members enable row level security;

-- Úroveň přístupu přihlášeného k věci: 'owner', 'editor', 'viewer', nebo null. Člen musí být stále v kanceláři vlastníka.
create or replace function public.case_access(p_case uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when c.user_id = auth.uid() then 'owner'
    else (select m.role from public.case_members m where m.case_id = c.id and m.user_id = auth.uid() and public.same_firm(c.user_id, auth.uid()) and public.has_lawyer_access(auth.uid()))
  end
  from public.cases c where c.id = p_case;
$$;
revoke all on function public.case_access(uuid) from public;
grant execute on function public.case_access(uuid) to authenticated;

create or replace function public.can_read_case(p_case uuid) returns boolean language sql stable security definer set search_path = public as $$ select public.case_access(p_case) is not null $$;
create or replace function public.can_write_case(p_case uuid) returns boolean language sql stable security definer set search_path = public as $$ select public.case_access(p_case) in ('owner', 'editor') $$;
revoke all on function public.can_read_case(uuid) from public; revoke all on function public.can_write_case(uuid) from public;
grant execute on function public.can_read_case(uuid) to authenticated; grant execute on function public.can_write_case(uuid) to authenticated;

-- Členové sdílení: vlastník věci je spravuje, člen vidí svůj záznam a smí věc opustit
drop policy if exists "case_members_select" on public.case_members;
create policy "case_members_select" on public.case_members for select to authenticated using (user_id = auth.uid() or public.case_access(case_id) = 'owner');
drop policy if exists "case_members_insert" on public.case_members;
create policy "case_members_insert" on public.case_members for insert to authenticated with check (
  added_by = auth.uid() and public.case_access(case_id) = 'owner' and user_id <> auth.uid() and public.same_firm(auth.uid(), user_id));
drop policy if exists "case_members_update" on public.case_members;
create policy "case_members_update" on public.case_members for update to authenticated using (public.case_access(case_id) = 'owner') with check (public.case_access(case_id) = 'owner' and public.same_firm(auth.uid(), user_id));
drop policy if exists "case_members_delete" on public.case_members;
create policy "case_members_delete" on public.case_members for delete to authenticated using (user_id = auth.uid() or public.case_access(case_id) = 'owner');

-- Jména pro zobrazení: vlastník a členové věci (smí volat každý, kdo k věci má přístup)
create or replace function public.case_share_info(p_case uuid)
returns table (user_id uuid, name text, email text, role text, is_owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.case_access(p_case) is null then return; end if;
  return query
    select c.user_id, coalesce(nullif(la.display_name, ''), nullif(la.firm_name, ''), la.email, ''), coalesce(la.email, ''), 'owner'::text, true
      from public.cases c left join public.lawyer_access la on la.user_id = c.user_id where c.id = p_case
    union all
    select m.user_id, coalesce(nullif(la.display_name, ''), nullif(la.firm_name, ''), la.email, ''), coalesce(la.email, ''), m.role, false
      from public.case_members m left join public.lawyer_access la on la.user_id = m.user_id where m.case_id = p_case;
end; $$;
revoke all on function public.case_share_info(uuid) from public;
grant execute on function public.case_share_info(uuid) to authenticated;

-- Věci: vidí je vlastník i členové; upravuje vlastník a editoři; zakládá a maže jen vlastník
drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own" on public.cases for select using (auth.uid() = user_id or public.can_read_case(id));
drop policy if exists "cases_update_own" on public.cases;
create policy "cases_update_own" on public.cases for update using (auth.uid() = user_id or public.can_write_case(id)) with check (auth.uid() = user_id or public.can_write_case(id));

-- Obsah věci: čtení pro každého, kdo věc vidí; zápis pro vlastníka a editory. Editor maže jen své záznamy, vlastník všechny.
do $$
declare t text;
begin
  foreach t in array array['case_folders', 'case_files', 'case_entries', 'case_deadlines', 'case_contacts'] loop
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select using (public.can_read_case(case_id))', t, t);
    execute format('create policy "%s_insert" on public.%I for insert with check (auth.uid() = user_id and public.can_write_case(case_id))', t, t);
    execute format('create policy "%s_update" on public.%I for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id))', t, t);
    execute format('create policy "%s_delete" on public.%I for delete using (public.case_access(case_id) = ''owner'' or (auth.uid() = user_id and public.can_write_case(case_id)))', t, t);
  end loop;
end $$;

-- Soubory ve sdílených věcech: složka v úložišti je ve tvaru <vlastník souboru>/<věc>/<soubor>
create or replace function public.storage_case(p_name text) returns uuid language sql immutable as $$
  select case when (string_to_array(p_name, '/'))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((string_to_array(p_name, '/'))[2])::uuid else null end
$$;
drop policy if exists "case-files: clenove cteni" on storage.objects;
create policy "case-files: clenove cteni" on storage.objects for select to authenticated
  using (bucket_id = 'case-files' and public.storage_case(name) is not null and public.can_read_case(public.storage_case(name)));
drop policy if exists "case-files: vlastnik veci mazani" on storage.objects;
create policy "case-files: vlastnik veci mazani" on storage.objects for delete to authenticated
  using (bucket_id = 'case-files' and public.storage_case(name) is not null and public.case_access(public.storage_case(name)) = 'owner');

do $$
begin
  execute 'drop trigger if exists lock_when_expired on public.case_members';
  execute 'create trigger lock_when_expired before insert or update or delete on public.case_members for each row execute function public.block_when_locked()';
end $$;
-- =====================================================================
-- POŠTA V APLIKACI (připojení e-mailové schránky přes IMAP a SMTP)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné zruseni-a-zamek.sql.
-- Heslo ke schránce je uložené JEN zašifrované šifrovacím heslem advokáta (e1:), server ho nezná.
-- Zprávy se v databázi neukládají; uloží se jen to, co advokát výslovně uloží do věci.
-- =====================================================================
create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '' check (char_length(label) <= 120),
  email text not null check (char_length(email) <= 200),
  preset text not null default 'jiny' check (preset in ('gmail', 'seznam', 'centrum', 'jiny')),
  imap_host text not null check (char_length(imap_host) <= 200),
  imap_port integer not null default 993 check (imap_port in (993, 143, 465, 587)),
  smtp_host text not null check (char_length(smtp_host) <= 200),
  smtp_port integer not null default 465 check (smtp_port in (993, 143, 465, 587)),
  sent_folder text not null default '' check (char_length(sent_folder) <= 200),
  skip_append boolean not null default false,
  enc_password text not null check (enc_password like 'e1:%'),
  created_at timestamptz not null default now()
);
alter table public.mail_accounts enable row level security;
drop policy if exists "mail_accounts_own" on public.mail_accounts;
create policy "mail_accounts_own" on public.mail_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$
begin
  execute 'drop trigger if exists lock_when_expired on public.mail_accounts';
  execute 'create trigger lock_when_expired before insert or update or delete on public.mail_accounts for each row execute function public.block_when_locked()';
end $$;

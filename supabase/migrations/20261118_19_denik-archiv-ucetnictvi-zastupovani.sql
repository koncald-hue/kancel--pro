-- =====================================================================
-- 20261118_19  PODACÍ DENÍK, ARCHIV A SKARTACE SPISŮ, ZÁLOHOVÉ A OPAKOVANÉ FAKTURY,
--              TÝDENNÍ SOUHRN A ZASTUPOVÁNÍ V TÝMU
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: fakturace.sql, sdilene-veci.sql (case_access), sdileni.sql (same_firm), zruseni-a-zamek.sql
-- (has_lawyer_access, block_when_locked), client-portal.sql (client_links), 20261118_05 (mfa_ok).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PODACÍ DENÍK: přijatá a odeslaná pošta s číslem jednacím kanceláře (RRRR/NNNN, řada pro každý rok zvlášť)
-- ---------------------------------------------------------------------
create table if not exists public.mail_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  year integer not null,
  seq integer not null,
  direction text not null check (direction in ('in', 'out')),
  channel text not null check (channel in ('datovka', 'email', 'listinna', 'osobne', 'jine')),
  event_on date not null default current_date,
  counterparty text not null default '' check (char_length(counterparty) <= 300),
  their_ref text not null default '' check (char_length(their_ref) <= 120),
  subject text not null check (char_length(subject) between 1 and 300),
  attachments integer not null default 0 check (attachments between 0 and 1000),
  delivered_on date,
  delivery_note text not null default '' check (char_length(delivery_note) <= 300),
  source_ref text check (source_ref is null or char_length(source_ref) <= 300),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, year, seq)
);
create unique index if not exists mail_log_source_idx on public.mail_log (user_id, source_ref) where source_ref is not null;
create index if not exists mail_log_user_idx on public.mail_log (user_id, event_on desc);
create index if not exists mail_log_case_idx on public.mail_log (case_id);

-- Číslo jednací přidělí databáze; uživatel ho nemůže zvolit ani později změnit
create or replace function public.mail_log_number() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.year := extract(year from new.event_on)::integer;
    perform pg_advisory_xact_lock(hashtext('mail_log:' || new.user_id::text || ':' || new.year::text));
    select coalesce(max(seq), 0) + 1 into new.seq from public.mail_log where user_id = new.user_id and year = new.year;
  else
    if new.year <> old.year or new.seq <> old.seq or new.user_id <> old.user_id or new.direction <> old.direction or new.event_on <> old.event_on then
      raise exception 'Číslo jednací, směr a datum zápisu v podacím deníku nelze měnit.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists mail_log_number_trg on public.mail_log;
create trigger mail_log_number_trg before insert or update on public.mail_log for each row execute function public.mail_log_number();

-- ---------------------------------------------------------------------
-- 2) ZASTUPOVÁNÍ: po dobu nepřítomnosti vidí zástupce (kolega z kanceláře) věci, lhůty a deník nepřítomného
-- ---------------------------------------------------------------------
create table if not exists public.substitutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  substitute_id uuid not null references auth.users(id) on delete cascade,
  from_on date not null,
  to_on date not null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (to_on >= from_on and to_on <= from_on + 366),
  check (substitute_id <> user_id)
);
create index if not exists substitutions_sub_idx on public.substitutions (substitute_id, from_on, to_on);
create index if not exists substitutions_user_idx on public.substitutions (user_id);

-- Zastupuji teď uživatele p_owner? (kolega ze stejné kanceláře, aktivní přístup, dnešek v období)
create or replace function public.is_substituting(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.substitutions s
     where s.user_id = p_owner and s.substitute_id = auth.uid()
       and current_date between s.from_on and s.to_on
       and public.same_firm(s.user_id, s.substitute_id)
       and public.has_lawyer_access(auth.uid())
  )
$$;
revoke all on function public.is_substituting(uuid) from public, anon;
grant execute on function public.is_substituting(uuid) to authenticated;

-- Přístup k věci: vlastník, zástupce po dobu zastupování (jako editor), jinak člen sdílení
create or replace function public.case_access(p_case uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when c.user_id = auth.uid() then 'owner'
    when public.is_substituting(c.user_id) then 'editor'
    else (select m.role from public.case_members m where m.case_id = c.id and m.user_id = auth.uid() and public.same_firm(c.user_id, auth.uid()) and public.has_lawyer_access(auth.uid()))
  end
  from public.cases c where c.id = p_case;
$$;
revoke all on function public.case_access(uuid) from public;
grant execute on function public.case_access(uuid) to authenticated;

alter table public.substitutions enable row level security;
drop policy if exists "substitutions_select" on public.substitutions;
create policy "substitutions_select" on public.substitutions for select to authenticated using (user_id = auth.uid() or substitute_id = auth.uid());
drop policy if exists "substitutions_write" on public.substitutions;
create policy "substitutions_write" on public.substitutions for insert to authenticated with check (user_id = auth.uid() and public.same_firm(auth.uid(), substitute_id));
drop policy if exists "substitutions_update" on public.substitutions;
create policy "substitutions_update" on public.substitutions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.same_firm(auth.uid(), substitute_id));
drop policy if exists "substitutions_delete" on public.substitutions;
create policy "substitutions_delete" on public.substitutions for delete to authenticated using (user_id = auth.uid());

-- Jména kolegů pro výběr zástupce a zobrazení „zastupujete…“ (jen ze stejné kanceláře)
create or replace function public.my_substitutions()
returns table (id uuid, user_id uuid, substitute_id uuid, from_on date, to_on date, note text, user_name text, substitute_name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, s.substitute_id, s.from_on, s.to_on, s.note,
         coalesce(nullif(a.display_name, ''), a.email), coalesce(nullif(b.display_name, ''), b.email)
    from public.substitutions s
    left join public.lawyer_access a on a.user_id = s.user_id
    left join public.lawyer_access b on b.user_id = s.substitute_id
   where (s.user_id = auth.uid() or s.substitute_id = auth.uid()) and s.to_on >= current_date - 30
   order by s.from_on
$$;
revoke all on function public.my_substitutions() from public, anon;
grant execute on function public.my_substitutions() to authenticated;

alter table public.mail_log enable row level security;
drop policy if exists "mail_log_select" on public.mail_log;
create policy "mail_log_select" on public.mail_log for select to authenticated using (user_id = auth.uid() or public.is_substituting(user_id));
drop policy if exists "mail_log_insert" on public.mail_log;
create policy "mail_log_insert" on public.mail_log for insert to authenticated with check (user_id = auth.uid() and (case_id is null or public.can_write_case(case_id)));
drop policy if exists "mail_log_update" on public.mail_log;
create policy "mail_log_update" on public.mail_log for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (case_id is null or public.can_write_case(case_id)));
-- Zápis v deníku se nemaže (evidence); případnou chybu opraví poznámka

-- ---------------------------------------------------------------------
-- 3) ARCHIV A SKARTACE SPISŮ: uzavřená věc dostane datum archivace, místo uložení a lhůtu, protokol se jen doplňuje
-- ---------------------------------------------------------------------
alter table public.cases add column if not exists archived_on date;
alter table public.cases add column if not exists archive_until date;
alter table public.cases add column if not exists archive_place text not null default '' check (char_length(archive_place) <= 200);
alter table public.cases add column if not exists disposed_on date;
alter table public.cases add column if not exists disposal text check (disposal is null or disposal in ('vydano', 'skartovano'));

create table if not exists public.case_archive_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  case_title text not null check (char_length(case_title) between 1 and 200),
  action text not null check (action in ('archivace', 'prodlouzeni', 'vydani', 'skartace', 'zruseni')),
  done_on date not null default current_date,
  until_on date,
  place text not null default '' check (char_length(place) <= 200),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists case_archive_log_user_idx on public.case_archive_log (user_id, done_on desc);
alter table public.case_archive_log enable row level security;
drop policy if exists "case_archive_log_select" on public.case_archive_log;
create policy "case_archive_log_select" on public.case_archive_log for select to authenticated using (user_id = auth.uid());
drop policy if exists "case_archive_log_insert" on public.case_archive_log;
create policy "case_archive_log_insert" on public.case_archive_log for insert to authenticated with check (user_id = auth.uid() and (case_id is null or public.case_access(case_id) = 'owner'));

-- Protokol jen přibývá (smazání účtu nebo věci zápis zachová díky on delete set null)
create or replace function public.case_archive_log_guard() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'case_id') = (to_jsonb(old) - 'case_id') then return new; end if;
  raise exception 'Protokol archivu nelze měnit ani mazat.';
end; $$;
drop trigger if exists case_archive_log_guard_trg on public.case_archive_log;
create trigger case_archive_log_guard_trg before update or delete on public.case_archive_log for each row execute function public.case_archive_log_guard();

-- Údaje archivu mění jen funkce archive_case (ne přímý zápis z aplikace)
create or replace function public.cases_archive_guard() returns trigger language plpgsql as $$
begin
  if (new.archived_on, new.archive_until, new.archive_place, new.disposed_on, new.disposal) is distinct from (old.archived_on, old.archive_until, old.archive_place, old.disposed_on, old.disposal)
     and current_setting('app.archive', true) is distinct from '1' and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Údaje archivu se mění jen úkonem v archivu.';
  end if;
  if old.archived_on is not null and new.status = 'open' then raise exception 'Archivovanou věc nelze znovu otevřít. Nejdřív zrušte archivaci.'; end if;
  return new;
end; $$;
drop trigger if exists cases_archive_guard_trg on public.cases;
create trigger cases_archive_guard_trg before update on public.cases for each row execute function public.cases_archive_guard();
-- Archivace, prodloužení, vydání a skartace jedním krokem: změní věc a zapíše protokol (jen vlastník).
-- Funkce nastaví příznak app.archive, aby ji pojistka nad tabulkou cases pustila.
create or replace function public.archive_case(p_case uuid, p_action text, p_on date, p_until date, p_place text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.cases;
begin
  if auth.uid() is null or not public.mfa_ok() or not public.has_lawyer_access() then raise exception 'Nemáte přístup.'; end if;
  select * into c from public.cases where id = p_case and user_id = auth.uid() for update;
  if not found then raise exception 'Věc nenalezena nebo nejste její vlastník.'; end if;
  if p_on is null or p_on > current_date then raise exception 'Datum nesmí být v budoucnosti.'; end if;
  perform set_config('app.archive', '1', true);
  if p_action = 'archivace' then
    if c.status <> 'done' then raise exception 'Archivovat lze jen uzavřenou věc.'; end if;
    if c.archived_on is not null then raise exception 'Věc už je archivovaná.'; end if;
    if p_until is null or p_until <= p_on then raise exception 'Lhůta uložení musí být po dni archivace.'; end if;
    update public.cases set archived_on = p_on, archive_until = p_until, archive_place = left(coalesce(p_place, ''), 200) where id = p_case;
  elsif p_action = 'prodlouzeni' then
    if c.archived_on is null or c.disposed_on is not null then raise exception 'Prodloužit lze jen archivovanou věc.'; end if;
    if p_until is null or p_until <= coalesce(c.archive_until, p_on) then raise exception 'Nová lhůta musí být pozdější než dosavadní.'; end if;
    update public.cases set archive_until = p_until where id = p_case;
  elsif p_action in ('vydani', 'skartace') then
    if c.archived_on is null or c.disposed_on is not null then raise exception 'Vydat nebo skartovat lze jen archivovanou věc.'; end if;
    if p_on < c.archived_on then raise exception 'Datum je před archivací.'; end if;
    if p_action = 'skartace' and p_on < c.archive_until then raise exception 'Lhůta uložení ještě neuplynula.'; end if;
    update public.cases set disposed_on = p_on, disposal = case when p_action = 'vydani' then 'vydano' else 'skartovano' end where id = p_case;
  elsif p_action = 'zruseni' then
    if c.archived_on is null or c.disposed_on is not null then raise exception 'Zrušit lze jen archivaci, která ještě neskončila vydáním ani skartací.'; end if;
    update public.cases set archived_on = null, archive_until = null, archive_place = '' where id = p_case;
  else raise exception 'Neznámý úkon.';
  end if;
  insert into public.case_archive_log (user_id, case_id, case_title, action, done_on, until_on, place, note)
  values (auth.uid(), p_case, left(c.title, 200), p_action, p_on, p_until, left(coalesce(p_place, ''), 200), left(coalesce(p_note, ''), 1000));
  perform set_config('app.archive', '', true);
end; $$;
revoke all on function public.archive_case(uuid, text, date, date, text, text) from public, anon;
grant execute on function public.archive_case(uuid, text, date, date, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) ZÁLOHOVÉ FAKTURY (výzva k platbě, není daňový doklad, vlastní řada Z RRRR-NNN) A OPAKOVANÁ FAKTURACE
-- ---------------------------------------------------------------------
alter table public.invoices add column if not exists kind text not null default 'faktura' check (kind in ('faktura', 'zaloha'));

create or replace function public.issue_invoice(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare inv public.invoices; la public.lawyer_access; cl public.lawyer_clients; v_year text; v_seq integer; v_num text; v_client jsonb; v_prefix text;
begin
  select * into inv from public.invoices where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Vyúčtování nenalezeno.'; end if;
  if inv.status <> 'draft' then raise exception 'Vyúčtování už je vystavené.'; end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then raise exception 'Vyúčtování nemá žádné položky.'; end if;
  select * into la from public.lawyer_access where user_id = auth.uid();
  if not found then raise exception 'Nejdřív zahajte zkušební přístup.'; end if;
  v_client := inv.client_snapshot;
  if inv.client_id is not null then
    select * into cl from public.lawyer_clients where id = inv.client_id and user_id = auth.uid();
    if found then v_client := jsonb_build_object('name', cl.name, 'address', cl.address, 'ico', cl.ico, 'dic', cl.dic, 'email', cl.email, 'phone', cl.phone); end if;
  end if;
  if coalesce(v_client ->> 'name', '') = '' then raise exception 'Vyberte klienta nebo vyplňte odběratele.'; end if;
  v_year := to_char(inv.issue_date, 'YYYY');
  -- Zálohy mají vlastní řadu „Z2026-001“, aby se nemíchaly s daňovými doklady
  v_prefix := case when inv.kind = 'zaloha' then 'Z' else '' end;
  perform pg_advisory_xact_lock(hashtext('invoice:' || auth.uid()::text || ':' || v_prefix || v_year));
  select coalesce(max(((regexp_match(number, '^' || v_prefix || '[0-9]{4}-([0-9]+)$'))[1])::integer), 0) + 1 into v_seq
    from public.invoices where user_id = auth.uid() and number like v_prefix || v_year || '-%';
  v_num := v_prefix || v_year || '-' || lpad(v_seq::text, 3, '0');
  perform set_config('app.issuing', '1', true);
  update public.invoices set
    status = 'issued', number = v_num, due_date = coalesce(due_date, issue_date + la.due_days),
    client_snapshot = v_client,
    supplier_snapshot = jsonb_build_object('name', coalesce(nullif(la.display_name, ''), la.email), 'firm', la.firm_name, 'address', la.office, 'ico', la.ico, 'dic', la.dic, 'vat_payer', la.vat_payer, 'bank_account', la.bank_account, 'email', coalesce(nullif(la.contact_email, ''), la.email), 'phone', la.phone, 'web', la.website, 'note', la.invoice_note, 'bar_number', la.bar_number)
  where id = inv.id;
  -- Čas se označí jako vyfakturovaný jen u řádné faktury, ne u zálohy
  if inv.kind = 'faktura' then
    update public.time_entries set billed = true where user_id = auth.uid() and id in (select time_entry_id from public.invoice_lines where invoice_id = inv.id and time_entry_id is not null);
  end if;
  return v_num;
end;
$$;
revoke all on function public.issue_invoice(uuid) from public;
grant execute on function public.issue_invoice(uuid) to authenticated;

create table if not exists public.invoice_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.lawyer_clients(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  -- [{ "description": "...", "qty": 1, "unit": "měsíc", "unit_price": 5000, "vat_rate": 21 }]
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 30),
  every text not null check (every in ('month', 'quarter', 'year')),
  next_on date not null,
  active boolean not null default true,
  last_period text,
  created_at timestamptz not null default now()
);
create index if not exists invoice_recurring_user_idx on public.invoice_recurring (user_id, next_on);
alter table public.invoice_recurring enable row level security;
drop policy if exists "invoice_recurring_own" on public.invoice_recurring;
create policy "invoice_recurring_own" on public.invoice_recurring for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5) TÝDENNÍ SOUHRN E-MAILEM (advokát pro sebe; klient jen u věcí, kde ho advokát zapne)
-- ---------------------------------------------------------------------
create table if not exists public.digest_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly boolean not null default false,
  -- false = jen počty a odkaz (e-mail jde přes poskytovatele rozesílky), true = i názvy věcí a lhůt
  details boolean not null default false,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.digest_settings enable row level security;
drop policy if exists "digest_settings_own" on public.digest_settings;
create policy "digest_settings_own" on public.digest_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.client_digest (
  case_id uuid primary key references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.client_digest enable row level security;
drop policy if exists "client_digest_own" on public.client_digest;
create policy "client_digest_own" on public.client_digest for all to authenticated using (user_id = auth.uid() and public.case_access(case_id) = 'owner') with check (user_id = auth.uid() and public.case_access(case_id) = 'owner');

-- ---------------------------------------------------------------------
-- Druhý faktor a zámek po skončení předplatného i pro nové tabulky
-- ---------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['mail_log', 'substitutions', 'case_archive_log', 'invoice_recurring', 'digest_settings', 'client_digest'] loop
    execute format('drop policy if exists "mfa_guard" on public.%I', t);
    execute format('create policy "mfa_guard" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
    execute format('drop trigger if exists lock_when_expired on public.%I', t);
    execute format('create trigger lock_when_expired before insert or update or delete on public.%I for each row execute function public.block_when_locked()', t);
  end loop;
end $$;

insert into public.schema_migrations (name) values ('20261118_19_denik-archiv-ucetnictvi-zastupovani') on conflict do nothing;

-- =====================================================================
-- 20261119_22  OPRAVA ČESKÝCH TEXTŮ VE FUNKCÍCH DATABÁZE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
--
-- Migrace 11, 15, 19, 20 a 21 se při vložení přes schránku uložily se špatně převedenou diakritikou
-- (např. „ńĆ√≠slo“ místo „Číslo“). Data v tabulkách to nepoškodilo, jen texty uvnitř funkcí: chybové hlášky,
-- popisy automatických faktur a výchozí jména. Tento soubor znovu spustí jejich úplné znění (vše jde spouštět
-- opakovaně, nic se nesmaže ani nezdvojí).
-- Kontrola po spuštění: tento řádek musí vypsat „Číslo jednací“ se správnou diakritikou:
--   select 'Číslo jednací' as kontrola;
-- =====================================================================


-- ===== znovu: 20261118_11_prehled-a-sablony.sql =====
-- =====================================================================
-- 20261118_11  PŘEHLED PRO VEDENÍ (dobrovolné sdílení hodin) A ŠABLONY ÚKOLŮ PRO NOVÉ VĚCI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: firms.sql (firms, firm_members), lawyer.sql (time_entries), 20261118_05 (mfa_ok), 20261117_01 (schema_migrations).
--
-- Hodiny podle lidí: vedoucí kanceláře vidí hodiny člena JEN když je člen sám zapnul (time_sharing.share).
-- Bez zapnutí vedoucí nevidí nic, ani součet. Člen může sdílení kdykoli vypnout. Sdílí se jen součty minut a částek
-- za období, nikdy popisy ani věci. To odpovídá slibu na stránce s cenami (data člena vedoucí nevidí).
-- Šablony: vlastní šablony úkolů (název, posun ve dnech od začátku nebo od data události, jen pracovní dny).
-- =====================================================================

create table if not exists public.time_sharing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.time_sharing enable row level security;
drop policy if exists "time_sharing_own" on public.time_sharing;
create policy "time_sharing_own" on public.time_sharing for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mfa_guard" on public.time_sharing;
create policy "mfa_guard" on public.time_sharing as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Hodiny členů pro vedoucího: jen u těch, kdo sdílení zapnuli. Ostatní se vrátí bez čísel (shared = false).
create or replace function public.team_hours(p_from date, p_to date)
returns table (user_id uuid, name text, shared boolean, minutes bigint, amount numeric, billed_minutes bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_firm uuid;
begin
  if auth.uid() is null or not public.mfa_ok() or not public.has_lawyer_access() then return; end if;
  select m.firm_id into v_firm from public.firm_members m where m.user_id = auth.uid() and m.role = 'owner';
  if v_firm is null then return; end if;
  return query
    select fm.user_id,
           coalesce(nullif(la.display_name, ''), nullif(la.email, ''), 'člen'),
           coalesce(ts.share, false) or fm.user_id = auth.uid(),
           case when coalesce(ts.share, false) or fm.user_id = auth.uid() then coalesce(sum(te.minutes), 0)::bigint end,
           case when coalesce(ts.share, false) or fm.user_id = auth.uid() then coalesce(sum(te.minutes * te.rate / 60.0), 0) end,
           case when coalesce(ts.share, false) or fm.user_id = auth.uid() then coalesce(sum(te.minutes) filter (where te.billed), 0)::bigint end
      from public.firm_members fm
      left join public.lawyer_access la on la.user_id = fm.user_id
      left join public.time_sharing ts on ts.user_id = fm.user_id
      left join public.time_entries te on te.user_id = fm.user_id and te.entry_date between p_from and p_to
                                      and (coalesce(ts.share, false) or fm.user_id = auth.uid())
     where fm.firm_id = v_firm
     group by fm.user_id, la.display_name, la.email, ts.share
     order by 4 desc nulls last;
end; $$;
revoke all on function public.team_hours(date, date) from public, anon;
grant execute on function public.team_hours(date, date) to authenticated;

-- Šablony úkolů
create table if not exists public.case_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- [{ "title": "...", "offset": 7, "base": "start" | "event", "workdays": true }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists case_templates_user_idx on public.case_templates (user_id);
alter table public.case_templates enable row level security;
drop policy if exists "case_templates_own" on public.case_templates;
create policy "case_templates_own" on public.case_templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mfa_guard" on public.case_templates;
create policy "mfa_guard" on public.case_templates as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

insert into public.schema_migrations (name) values ('20261118_11_prehled-a-sablony') on conflict do nothing;

-- ===== znovu: 20261118_15_oprava-pojistek-uschov.sql =====
-- =====================================================================
-- 20261118_15  OPRAVA POJISTEK ÚSCHOV (spouštět po 20261118_14)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Pojistky četly auth.users jako přihlášený uživatel, na to nemá právo, takže mazání úschovy bez pohybů padalo
-- na „permission denied“. Funkce teď běží jako security definer (s pevným search_path).
-- =====================================================================

create or replace function public.escrow_moves_guard() returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_status text; v_owner uuid; v_cur text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- správce databáze (service role) a kaskáda při smazání úschovy nebo celého účtu (GDPR) smí; běžný uživatel nikdy
    if coalesce(auth.role(), '') = 'service_role' and tg_op = 'DELETE' then return old; end if;
    if tg_op = 'DELETE' and (not exists (select 1 from public.escrows where id = old.escrow_id) or not exists (select 1 from auth.users where id = old.user_id)) then return old; end if;
    raise exception 'Pohyby úschovy nelze měnit ani mazat, použijte opravný pohyb.';
  end if;
  select status, user_id into v_status, v_owner from public.escrows where id = new.escrow_id;
  if v_status is null or v_owner <> new.user_id then raise exception 'Úschova neexistuje.'; end if;
  if v_status <> 'open' then raise exception 'Úschova je uzavřená.'; end if;
  if new.kind in ('payout', 'correction_out') and new.amount > public.escrow_balance(new.escrow_id) then
    raise exception 'Výdej převyšuje zůstatek úschovy.';
  end if;
  return new;
end; $$;

create or replace function public.escrows_guard() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op = 'UPDATE' then
    -- u uzavřené úschovy smí databáze jen odpojit smazaného klienta nebo věc (on delete set null)
    if old.status = 'closed' then
      if (to_jsonb(new) - 'client_id' - 'case_id') = (to_jsonb(old) - 'client_id' - 'case_id') then return new; end if;
      raise exception 'Uzavřenou úschovu nelze měnit.';
    end if;
    if new.status = 'closed' and public.escrow_balance(old.id) <> 0 then raise exception 'Úschovu lze uzavřít jen s nulovým zůstatkem.'; end if;
    if new.currency <> old.currency or new.user_id <> old.user_id then raise exception 'Měnu ani vlastníka úschovy nelze měnit.'; end if;
    if new.status = 'closed' and new.closed_on is null then new.closed_on := current_date; end if;
  elsif tg_op = 'DELETE' then
    if coalesce(auth.role(), '') = 'service_role' or not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
    if exists (select 1 from public.escrow_moves where escrow_id = old.id) then raise exception 'Úschovu s pohyby nelze smazat.'; end if;
    return old;
  end if;
  return new;
end; $$;

insert into public.schema_migrations (name) values ('20261118_15_oprava-pojistek-uschov') on conflict do nothing;

-- ===== znovu: 20261118_19_denik-archiv-ucetnictvi-zastupovani.sql =====
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

-- ===== znovu: 20261118_20_ucetnictvi-provozovatele.sql =====
-- =====================================================================
-- 20261118_20  ÚČETNICTVÍ PROVOZOVATELE A SPRÁVA (jen pro tým provozovatele, is_staff)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: 00-zaklad.sql (is_staff), verification-billing.sql (lawyer_orders), insolvence.sql (isir_orders),
-- lawyer.sql (lawyer_access), 20261117_01 (schema_migrations).
--
-- 1) Údaje provozovatele pro doklady (dodavatel, plátce DPH, sazba, řada čísel).
-- 2) Automatická faktura: jakmile se objednávka (předplatné, balíček kanceláře, hlídání insolvence) označí jako zaplacená,
--    databáze vystaví fakturu s dalším číslem řady a snímkem odběratele. Stejná objednávka dostane fakturu jen jednou.
-- 3) Výdaje provozovatele (ruční zápis), poznámky správce k uživatelům a záznam úkonů správce.
-- Částka objednávky (price_czk) je konečná cena pro zákazníka; u plátce DPH se z ní DPH vypočítá „shora“.
-- Faktury se nemažou; oprava je dobropis (záporná faktura s odkazem na původní).
-- =====================================================================

create table if not exists public.ops_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default '',
  address text not null default '',
  ico text not null default '',
  dic text not null default '',
  vat_payer boolean not null default false,
  vat_rate numeric(5, 2) not null default 21 check (vat_rate in (0, 12, 21)),
  bank_account text not null default '',
  email text not null default '',
  register_note text not null default '' check (char_length(register_note) <= 300),
  prefix text not null default '' check (prefix ~ '^[A-Z]{0,4}$'),
  due_days integer not null default 14 check (due_days between 0 and 90),
  updated_at timestamptz not null default now()
);
insert into public.ops_settings (id) values (1) on conflict do nothing;

create table if not exists public.ops_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  year integer not null,
  seq integer not null,
  source text not null check (source in ('predplatne', 'insolvence', 'eshop', 'rucne', 'dobropis')),
  source_ref text,
  user_id uuid references auth.users(id) on delete set null,
  issue_date date not null,
  paid_on date,
  description text not null check (char_length(description) between 1 and 300),
  total numeric(12, 2) not null,
  base numeric(12, 2) not null,
  vat numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  buyer jsonb not null default '{}'::jsonb,
  supplier jsonb not null default '{}'::jsonb,
  credit_for uuid references public.ops_invoices(id),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (year, seq)
);
create unique index if not exists ops_invoices_source_idx on public.ops_invoices (source, source_ref) where source_ref is not null;

create table if not exists public.ops_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  supplier text not null default '' check (char_length(supplier) <= 200),
  description text not null check (char_length(description) between 1 and 300),
  category text not null default 'ostatni' check (category in ('hosting', 'software', 'marketing', 'pravni', 'ucetni', 'bankovni', 'ostatni')),
  total numeric(12, 2) not null check (total > 0),
  vat numeric(12, 2) not null default 0 check (vat >= 0),
  doc_no text not null default '' check (char_length(doc_no) <= 60),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_log (
  id bigint generated always as identity primary key,
  staff_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target text not null default '' check (char_length(target) <= 300),
  detail text not null default '' check (char_length(detail) <= 1000),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['ops_settings', 'ops_invoices', 'ops_expenses', 'ops_notes', 'ops_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff_select" on public.%I', t);
    execute format('create policy "staff_select" on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
end $$;
-- Zápisy: nastavení, výdaje a poznámky smí tým měnit; faktury vznikají jen funkcemi; záznam úkonů se jen přidává
drop policy if exists "staff_write" on public.ops_settings;
create policy "staff_write" on public.ops_settings for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_write" on public.ops_expenses;
create policy "staff_write" on public.ops_expenses for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_write" on public.ops_notes;
create policy "staff_write" on public.ops_notes for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_insert" on public.ops_log;
create policy "staff_insert" on public.ops_log for insert to authenticated with check (public.is_staff() and staff_id = auth.uid());

-- Vystavení faktury (vnitřní funkce): další číslo řady, výpočet DPH „shora“ a snímky dodavatele i odběratele
create or replace function public.ops_issue(p_source text, p_ref text, p_user uuid, p_total numeric, p_desc text, p_paid timestamptz, p_buyer jsonb, p_credit_for uuid default null, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.ops_settings; v_year integer; v_seq integer; v_id uuid; v_rate numeric; v_base numeric; v_vat numeric; v_date date;
begin
  if p_ref is not null and exists (select 1 from public.ops_invoices where source = p_source and source_ref = p_ref) then return null; end if;
  select * into s from public.ops_settings where id = 1;
  v_date := coalesce(p_paid::date, current_date);
  v_year := extract(year from v_date)::integer;
  perform pg_advisory_xact_lock(hashtext('ops_invoice:' || v_year::text));
  select coalesce(max(seq), 0) + 1 into v_seq from public.ops_invoices where year = v_year;
  v_rate := case when coalesce(s.vat_payer, false) then s.vat_rate else 0 end;
  v_base := round(p_total / (1 + v_rate / 100), 2);
  v_vat := round(p_total - v_base, 2);
  insert into public.ops_invoices (number, year, seq, source, source_ref, user_id, issue_date, paid_on, description, total, base, vat, vat_rate, buyer, supplier, credit_for, note)
  values (coalesce(s.prefix, '') || v_year::text || lpad(v_seq::text, 4, '0'), v_year, v_seq, p_source, p_ref, p_user, v_date, p_paid::date, left(p_desc, 300), p_total, v_base, v_vat, v_rate,
          coalesce(p_buyer, '{}'::jsonb),
          jsonb_build_object('name', s.name, 'address', s.address, 'ico', s.ico, 'dic', s.dic, 'vat_payer', s.vat_payer, 'bank_account', s.bank_account, 'email', s.email, 'register_note', s.register_note),
          p_credit_for, left(coalesce(p_note, ''), 500))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.ops_issue(text, text, uuid, numeric, text, timestamptz, jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.ops_buyer(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('name', coalesce(nullif(la.firm_name, ''), nullif(la.display_name, ''), la.email), 'address', la.office, 'ico', la.ico, 'dic', la.dic, 'email', la.email)
                     from public.lawyer_access la where la.user_id = p_user), '{}'::jsonb)
$$;
revoke all on function public.ops_buyer(uuid) from public, anon, authenticated;

-- Automaticky při zaplacení objednávky
create or replace function public.ops_on_lawyer_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.ops_issue('predplatne', new.id::text, new.user_id, new.price_czk,
      'Předplatné aplikace Kancelář (' || case new.plan when 'month' then '1 měsíc' when 'half' then '6 měsíců' else '12 měsíců' end ||
        case when coalesce(to_jsonb(new) ->> 'seats', '') <> '' then ', ' || (to_jsonb(new) ->> 'seats') || ' míst' else '' end ||
        case when new.period_start is not null then ', ' || to_char(new.period_start, 'DD.MM.YYYY') || '–' || to_char(new.period_end, 'DD.MM.YYYY') else '' end || ')',
      coalesce(new.paid_at, now()), public.ops_buyer(new.user_id));
  end if;
  return new;
end; $$;
drop trigger if exists ops_lawyer_order_trg on public.lawyer_orders;
create trigger ops_lawyer_order_trg after insert or update of status on public.lawyer_orders for each row execute function public.ops_on_lawyer_order();

create or replace function public.ops_on_isir_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.ops_issue('insolvence', new.id::text, new.user_id, new.price_czk,
      'Hlídání insolvenčního rejstříku (' || case new.plan when 'month' then '1 měsíc' when 'half' then '6 měsíců' else '12 měsíců' end ||
        case when new.period_end is not null then ', do ' || to_char(new.period_end, 'DD.MM.YYYY') else '' end || ')',
      coalesce(new.paid_at, now()), public.ops_buyer(new.user_id));
  end if;
  return new;
end; $$;
drop trigger if exists ops_isir_order_trg on public.isir_orders;
create trigger ops_isir_order_trg after insert or update of status on public.isir_orders for each row execute function public.ops_on_isir_order();

-- Ruční faktura a dobropis (jen tým)
create or replace function public.ops_manual_invoice(p_desc text, p_total numeric, p_paid date, p_buyer jsonb, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_staff() then raise exception 'Jen pro tým provozovatele.'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Částka musí být kladná.'; end if;
  if coalesce(p_buyer ->> 'name', '') = '' then raise exception 'Vyplňte odběratele.'; end if;
  v := public.ops_issue('rucne', null, null, p_total, p_desc, coalesce(p_paid, current_date)::timestamptz, p_buyer, null, p_note);
  insert into public.ops_log (staff_id, action, target, detail) values (auth.uid(), 'ruční faktura', (select number from public.ops_invoices where id = v), left(p_desc, 300));
  return v;
end; $$;
revoke all on function public.ops_manual_invoice(text, numeric, date, jsonb, text) from public, anon;
grant execute on function public.ops_manual_invoice(text, numeric, date, jsonb, text) to authenticated;

create or replace function public.ops_credit_note(p_invoice uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.ops_invoices; v uuid;
begin
  if not public.is_staff() then raise exception 'Jen pro tým provozovatele.'; end if;
  select * into i from public.ops_invoices where id = p_invoice;
  if not found or i.total <= 0 then raise exception 'Fakturu nelze dobropisovat.'; end if;
  if exists (select 1 from public.ops_invoices where credit_for = i.id) then raise exception 'K faktuře už dobropis existuje.'; end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'Uveďte důvod dobropisu.'; end if;
  v := public.ops_issue('dobropis', null, i.user_id, -i.total, 'Dobropis k faktuře ' || i.number, now(), i.buyer, i.id, p_reason);
  insert into public.ops_log (staff_id, action, target, detail) values (auth.uid(), 'dobropis', i.number, left(p_reason, 300));
  return v;
end; $$;
revoke all on function public.ops_credit_note(uuid, text) from public, anon;
grant execute on function public.ops_credit_note(uuid, text) to authenticated;

-- Doplnění faktur k objednávkám zaplaceným před zapnutím účetnictví (jednorázově, jen tým)
create or replace function public.ops_backfill() returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v uuid;
begin
  if not public.is_staff() then raise exception 'Jen pro tým provozovatele.'; end if;
  for r in select * from public.lawyer_orders where status = 'paid' order by coalesce(paid_at, created_at) loop
    v := public.ops_issue('predplatne', r.id::text, r.user_id, r.price_czk, 'Předplatné aplikace Kancelář (' || case r.plan when 'month' then '1 měsíc' when 'half' then '6 měsíců' else '12 měsíců' end || ')', coalesce(r.paid_at, r.created_at), public.ops_buyer(r.user_id));
    if v is not null then n := n + 1; end if;
  end loop;
  for r in select * from public.isir_orders where status = 'paid' order by coalesce(paid_at, created_at) loop
    v := public.ops_issue('insolvence', r.id::text, r.user_id, r.price_czk, 'Hlídání insolvenčního rejstříku', coalesce(r.paid_at, r.created_at), public.ops_buyer(r.user_id));
    if v is not null then n := n + 1; end if;
  end loop;
  insert into public.ops_log (staff_id, action, detail) values (auth.uid(), 'doplnění faktur', n::text);
  return n;
end; $$;
revoke all on function public.ops_backfill() from public, anon;
grant execute on function public.ops_backfill() to authenticated;

insert into public.schema_migrations (name) values ('20261118_20_ucetnictvi-provozovatele') on conflict do nothing;

-- ===== znovu: 20261118_21_ukoly-tymu-a-kalendar.sql =====
-- =====================================================================
-- 20261118_21  ÚKOLY MEZI KOLEGY A KALENDÁŘ KANCELÁŘE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: sdileni.sql (same_firm), firms.sql (firm_members), zruseni-a-zamek.sql (has_lawyer_access, block_when_locked),
-- 20261118_05 (mfa_ok), 20261117_01 (schema_migrations).
--
-- 1) Úkoly pro kolegy: kdo zadal, komu, co, do kdy (případně v kolik). Vidí je jen zadavatel a řešitel.
--    Řešitel smí úkol jen splnit, vrátit do práce nebo odmítnout s poznámkou; měnit zadání smí jen zadavatel.
--    Úkol může odkazovat na věc; řešitel uvidí jen její název (snímek), ne obsah věci, pokud mu věc někdo nesdílel.
-- 2) Události kalendáře (jednání, schůzky, telefonáty): vlastní, nebo s pozvanými kolegy z kanceláře, kteří je pak vidí taky.
-- =====================================================================

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  assignee_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  due_date date not null,
  due_time time,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  case_id uuid references public.cases(id) on delete set null,
  case_title text not null default '' check (char_length(case_title) <= 200),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  done_at timestamptz,
  answer text not null default '' check (char_length(answer) <= 1000),
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_tasks_assignee_idx on public.team_tasks (assignee_id, status, due_date);
create index if not exists team_tasks_creator_idx on public.team_tasks (created_by, status, due_date);

alter table public.team_tasks enable row level security;
drop policy if exists "team_tasks_select" on public.team_tasks;
create policy "team_tasks_select" on public.team_tasks for select to authenticated using (created_by = auth.uid() or assignee_id = auth.uid());
drop policy if exists "team_tasks_insert" on public.team_tasks;
create policy "team_tasks_insert" on public.team_tasks for insert to authenticated with check (
  created_by = auth.uid() and (assignee_id = auth.uid() or public.same_firm(auth.uid(), assignee_id))
  and (case_id is null or public.can_write_case(case_id)));
drop policy if exists "team_tasks_update" on public.team_tasks;
create policy "team_tasks_update" on public.team_tasks for update to authenticated using (created_by = auth.uid() or assignee_id = auth.uid())
  with check (created_by = auth.uid() or assignee_id = auth.uid());
drop policy if exists "team_tasks_delete" on public.team_tasks;
create policy "team_tasks_delete" on public.team_tasks for delete to authenticated using (created_by = auth.uid());

-- Řešitel (který úkol nezadal) smí měnit jen stav, odpověď a „viděno“; název věci se doplní ze záznamu věci
create or replace function public.team_tasks_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.case_id is not null then select left(title, 200) into new.case_title from public.cases where id = new.case_id; end if;
    new.status := 'open'; new.done_at := null; new.answer := ''; new.seen_at := case when new.assignee_id = new.created_by then now() else null end;
    return new;
  end if;
  if auth.uid() = old.assignee_id and auth.uid() <> old.created_by then
    if (new.title, new.note, new.due_date, new.due_time, new.priority, new.case_id, new.assignee_id, new.created_by)
       is distinct from (old.title, old.note, old.due_date, old.due_time, old.priority, old.case_id, old.assignee_id, old.created_by) then
      raise exception 'Zadání úkolu může měnit jen ten, kdo ho zadal.';
    end if;
  end if;
  if new.assignee_id <> old.assignee_id then
    if not (new.assignee_id = old.created_by or public.same_firm(old.created_by, new.assignee_id)) then raise exception 'Úkol lze předat jen kolegovi z kanceláře.'; end if;
    new.status := 'open'; new.done_at := null; new.seen_at := null;
  end if;
  if new.case_id is distinct from old.case_id then
    new.case_title := coalesce((select left(title, 200) from public.cases where id = new.case_id), '');
  end if;
  if new.status = 'done' and old.status <> 'done' then new.done_at := now(); end if;
  if new.status = 'open' then new.done_at := null; end if;
  if new.status = 'declined' and char_length(btrim(new.answer)) < 2 then raise exception 'Při odmítnutí napište důvod.'; end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists team_tasks_guard_trg on public.team_tasks;
create trigger team_tasks_guard_trg before insert or update on public.team_tasks for each row execute function public.team_tasks_guard();

-- Události kalendáře
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'schuzka' check (kind in ('jednani', 'schuzka', 'telefon', 'osobni', 'jine')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  place text not null default '' check (char_length(place) <= 200),
  note text not null default '' check (char_length(note) <= 2000),
  case_id uuid references public.cases(id) on delete set null,
  case_title text not null default '' check (char_length(case_title) <= 200),
  attendees uuid[] not null default '{}' check (cardinality(attendees) <= 30),
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at and ends_at <= starts_at + interval '31 days')
);
create index if not exists calendar_events_user_idx on public.calendar_events (user_id, starts_at);
create index if not exists calendar_events_attendees_idx on public.calendar_events using gin (attendees);

alter table public.calendar_events enable row level security;
drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select" on public.calendar_events for select to authenticated using (user_id = auth.uid() or auth.uid() = any (attendees));
drop policy if exists "calendar_events_write" on public.calendar_events;
create policy "calendar_events_write" on public.calendar_events for insert to authenticated with check (user_id = auth.uid() and (case_id is null or public.can_read_case(case_id)));
drop policy if exists "calendar_events_update" on public.calendar_events;
create policy "calendar_events_update" on public.calendar_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (case_id is null or public.can_read_case(case_id)));
drop policy if exists "calendar_events_delete" on public.calendar_events;
create policy "calendar_events_delete" on public.calendar_events for delete to authenticated using (user_id = auth.uid());

-- Pozvat lze jen kolegy ze stejné kanceláře; název věci se uloží jako snímek
create or replace function public.calendar_events_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  new.attendees := array(select distinct x from unnest(new.attendees) x where x <> new.user_id);
  foreach a in array new.attendees loop
    if not public.same_firm(new.user_id, a) then raise exception 'Pozvat lze jen kolegy z kanceláře.'; end if;
  end loop;
  if new.case_id is not null and (tg_op = 'INSERT' or new.case_id is distinct from old.case_id) then
    new.case_title := coalesce((select left(title, 200) from public.cases where id = new.case_id), '');
  elsif new.case_id is null then new.case_title := '';
  end if;
  return new;
end; $$;
drop trigger if exists calendar_events_guard_trg on public.calendar_events;
create trigger calendar_events_guard_trg before insert or update on public.calendar_events for each row execute function public.calendar_events_guard();

-- Jména kolegů k úkolům a událostem (jen lidé, se kterými úkol nebo událost sdílím)
create or replace function public.people_names(p_ids uuid[]) returns table (user_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select la.user_id, coalesce(nullif(la.display_name, ''), la.email)
    from public.lawyer_access la
   where la.user_id = any (p_ids) and (la.user_id = auth.uid() or public.same_firm(auth.uid(), la.user_id))
$$;
revoke all on function public.people_names(uuid[]) from public, anon;
grant execute on function public.people_names(uuid[]) to authenticated;

do $$ declare t text; begin
  foreach t in array array['team_tasks', 'calendar_events'] loop
    execute format('drop policy if exists "mfa_guard" on public.%I', t);
    execute format('create policy "mfa_guard" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
    execute format('drop trigger if exists lock_when_expired on public.%I', t);
    execute format('create trigger lock_when_expired before insert or update or delete on public.%I for each row execute function public.block_when_locked()', t);
  end loop;
end $$;

insert into public.schema_migrations (name) values ('20261118_21_ukoly-tymu-a-kalendar') on conflict do nothing;

select 'Číslo jednací' as kontrola;
insert into public.schema_migrations (name) values ('20261119_22_oprava-kodovani') on conflict do nothing;

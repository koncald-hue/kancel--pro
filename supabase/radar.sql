-- =====================================================================
-- RADAR PROTISTRANY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné case-files.sql, insolvence.sql, insolvence-klienti.sql, lhuty-z-datovek.sql,
-- sdilene-veci.sql (can_read_case) a zruseni-a-zamek.sql.
--
-- Kontakty věci (protistrana, dlužník, firma) lze hlídat: u firmy podle IČO (ARES a insolvenční rejstřík),
-- u fyzické osoby podle jména a data narození (insolvenční rejstřík, jen s doplňkem Hlídání insolvence).
-- radar_snapshots: poslední známý stav firmy z ARES (porovnává ho prohlížeč advokáta, nejvýše jednou za 12 hodin).
-- radar_events: zjištěné události (insolvence, likvidace, zánik, změna názvu nebo sídla). Lhůtu advokát jen potvrzuje.
-- =====================================================================
alter table public.case_contacts add column if not exists ico text not null default '' check (ico = '' or ico ~ '^[0-9]{8}$');
alter table public.case_contacts add column if not exists birth date check (birth is null or (birth >= date '1900-01-01' and birth <= current_date));
alter table public.case_contacts add column if not exists watch boolean not null default false;

alter table public.isir_watches add column if not exists contact_id uuid references public.case_contacts(id) on delete cascade;
create index if not exists isir_watches_contact_idx on public.isir_watches (contact_id);

-- Hlídaný kontakt se zapíše do hlídání insolvence (jen u uživatele s doplňkem). Firma podle IČO, osoba podle jména a data narození.
create or replace function public.contact_watch_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_words text[]; v_first text; v_last text;
begin
  delete from public.isir_watches where contact_id = new.id;
  if not new.watch or not public.has_isir(new.user_id) then return new; end if;
  if new.ico ~ '^[0-9]{8}$' then
    -- Stejná firma už může být hlídaná (např. jako klient); události se pak k věci přiřadí podle IČO
    if not exists (select 1 from public.isir_watches w where w.user_id = new.user_id and w.kind = 'firma' and w.ic = new.ico) then
      insert into public.isir_watches (user_id, label, kind, ic, contact_id, auto) values (new.user_id, left(new.name, 160), 'firma', new.ico, new.id, true);
    end if;
  elsif new.birth is not null then
    -- Tituly (slova končící tečkou) se vynechají; první slovo je jméno, zbytek příjmení
    v_words := array(select w from unnest(regexp_split_to_array(btrim(new.name), '\s+')) as w where w !~ '\.$' and w <> '');
    if array_length(v_words, 1) >= 2 then
      v_first := v_words[1]; v_last := array_to_string(v_words[2:], ' ');
      if char_length(v_first) >= 2 and char_length(v_last) >= 2 then
        insert into public.isir_watches (user_id, label, kind, name, first_name, birth, contact_id, auto) values (new.user_id, left(new.name, 160), 'osoba', v_last, v_first, new.birth, new.id, true);
      end if;
    end if;
  end if;
  return new;
exception when others then
  -- Nejde-li hlídání založit (např. limit), kontakt se přesto uloží
  return new;
end; $$;
drop trigger if exists case_contacts_isir on public.case_contacts;
create trigger case_contacts_isir after insert or update of ico, birth, watch, name on public.case_contacts for each row execute function public.contact_watch_trigger();

create table if not exists public.radar_snapshots (
  contact_id uuid primary key references public.case_contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ico text not null default '',
  name text not null default '' check (char_length(name) <= 400),
  address text not null default '' check (char_length(address) <= 400),
  ended date,
  checked_at timestamptz not null default now(),
  last_error text not null default '' check (char_length(last_error) <= 300)
);
alter table public.radar_snapshots enable row level security;
drop policy if exists "radar_snapshots_own" on public.radar_snapshots;
create policy "radar_snapshots_own" on public.radar_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.radar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  contact_id uuid references public.case_contacts(id) on delete cascade,
  kind text not null check (kind in ('insolvence', 'insolvence_konec', 'likvidace', 'zanik', 'zmena_nazvu', 'zmena_sidla')),
  ref text not null default '' check (char_length(ref) <= 300),
  title text not null default '' check (char_length(title) <= 300),
  detail text not null default '' check (char_length(detail) <= 1000),
  url text not null default '' check (char_length(url) <= 500),
  event_date date,
  seen boolean not null default false,
  resolved boolean not null default false,
  deadline_id uuid references public.case_deadlines(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists radar_events_unique on public.radar_events (contact_id, kind, ref);
create index if not exists radar_events_user_idx on public.radar_events (user_id, resolved, created_at desc);
create index if not exists radar_events_case_idx on public.radar_events (case_id);
alter table public.radar_events enable row level security;
drop policy if exists "radar_events_select" on public.radar_events;
create policy "radar_events_select" on public.radar_events for select using (user_id = auth.uid() or public.can_read_case(case_id));
drop policy if exists "radar_events_insert" on public.radar_events;
create policy "radar_events_insert" on public.radar_events for insert with check (user_id = auth.uid() and public.can_write_case(case_id));
drop policy if exists "radar_events_update" on public.radar_events;
create policy "radar_events_update" on public.radar_events for update using (user_id = auth.uid() or public.can_write_case(case_id)) with check (user_id = auth.uid() or public.can_write_case(case_id));
drop policy if exists "radar_events_delete" on public.radar_events;
create policy "radar_events_delete" on public.radar_events for delete using (user_id = auth.uid());

-- Nález v insolvenčním rejstříku (zapisuje ho denní kontrola) se promítne do všech věcí, kde je dotyčný hlídaným kontaktem
create or replace function public.radar_from_isir()
returns trigger language plpgsql security definer set search_path = public as $$
declare w record; c record; v_id uuid; v_kind text; v_title text; v_detail text;
begin
  select * into w from public.isir_watches where id = new.watch_id;
  if not found then return new; end if;
  v_kind := case when new.ended is not null then 'insolvence_konec' else 'insolvence' end;
  v_detail := left(concat_ws(' · ', nullif(new.court, ''), 'sp. zn. ' || new.spis, nullif(new.state, '')), 1000);
  for c in select * from public.case_contacts cc
           where cc.watch and cc.user_id = w.user_id and (cc.id = w.contact_id or (w.kind = 'firma' and cc.ico = w.ic and w.ic <> '')) loop
    v_title := left(case when new.ended is not null then 'Insolvenční řízení skončilo: ' else 'Insolvence: ' end || coalesce(nullif(new.debtor, ''), c.name), 300);
    v_id := null;
    insert into public.radar_events (user_id, case_id, contact_id, kind, ref, title, detail, url, event_date)
      values (c.user_id, c.case_id, c.id, v_kind, left(new.spis || ':' || coalesce(new.state, '') || ':' || coalesce(new.ended::text, ''), 300), v_title, v_detail, coalesce(new.url, ''), coalesce(new.ended, new.started))
      on conflict (contact_id, kind, ref) do nothing
      returning id into v_id;
    -- Nová událost se zapíše i do chronologie věci
    if v_id is not null then
      insert into public.case_entries (case_id, user_id, kind, title, body, happened_on)
        values (c.case_id, c.user_id, 'event', left('Radar: ' || v_title, 200), left(v_detail || case when new.url <> '' then E'\n' || new.url else '' end, 4000), coalesce(new.ended, new.started, current_date));
    end if;
  end loop;
  return new;
exception when others then
  -- Radar nesmí nikdy zablokovat zápis nálezu
  return new;
end; $$;
drop trigger if exists isir_hits_radar on public.isir_hits;
create trigger isir_hits_radar after insert or update of state, ended on public.isir_hits for each row execute function public.radar_from_isir();

do $$
declare t text;
begin
  foreach t in array array['radar_snapshots', 'radar_events'] loop
    execute format('drop trigger if exists lock_when_expired on public.%I', t);
    execute format('create trigger lock_when_expired before insert or update or delete on public.%I for each row execute function public.block_when_locked()', t);
  end loop;
end $$;

-- Už existující hlídané kontakty a nálezy se promítnou hned
update public.case_contacts set watch = watch where watch;

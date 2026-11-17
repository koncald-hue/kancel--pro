-- =====================================================================
-- 20261117_01  ÚKOLY A POTVRZENÍ LHŮT (pracovní přehled „Dnes“)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: case-files.sql, client-portal.sql, sdilene-veci.sql (nebo _nove-dohromady.sql), security-hardening.sql.
--
-- Co dělá (zpětně kompatibilně, nic nemaže a existující řádky nemění):
--  * evidence migrací public.schema_migrations (jen pro čtení provozovatelem, viz scripts/migrations-status.mjs),
--  * case_deadlines dostává: druh (lhůta / úkol), odpovědnou osobu, kdo a kdy datum potvrdil,
--    vazbu na vypočtenou lhůtu (law_key), vazbu na poptávku a čas splnění.
--  * Kontroly jsou v databázi (trigger), ne jen v aplikaci:
--      - odpovědná osoba musí být vlastník věci nebo člen sdílené věci,
--      - potvrzení zapíše vždy přihlášený uživatel a čas serveru (nejde podvrhnout jiné jméno ani datum),
--      - poptávka jde navázat jen na věc stejného advokáta.
--  * Existující lhůty zůstávají NEPOTVRZENÉ (confirmed_at = null). Aplikace je nevydává za ověřené.
-- =====================================================================

create table if not exists public.schema_migrations (
  name text primary key check (char_length(name) between 1 and 200),
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from public, anon, authenticated;
grant all on public.schema_migrations to service_role;

alter table public.case_deadlines add column if not exists kind text not null default 'lhuta';
alter table public.case_deadlines drop constraint if exists case_deadlines_kind_check;
alter table public.case_deadlines add constraint case_deadlines_kind_check check (kind in ('lhuta', 'ukol'));
alter table public.case_deadlines add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table public.case_deadlines add column if not exists confirmed_at timestamptz;
alter table public.case_deadlines add column if not exists confirmed_by uuid references auth.users(id) on delete set null;
alter table public.case_deadlines add column if not exists law_key text;
alter table public.case_deadlines drop constraint if exists case_deadlines_law_key_check;
alter table public.case_deadlines add constraint case_deadlines_law_key_check check (law_key is null or law_key ~ '^law-[A-Za-z0-9_.-]{1,80}$');
alter table public.case_deadlines add column if not exists inquiry_id uuid references public.lawyer_inquiries(id) on delete set null;
alter table public.case_deadlines add column if not exists done_at timestamptz;

create unique index if not exists case_deadlines_law_key_unique on public.case_deadlines (case_id, law_key) where law_key is not null;
create index if not exists case_deadlines_assignee_idx on public.case_deadlines (assignee_id, due_date) where not done;
create index if not exists case_deadlines_open_idx on public.case_deadlines (due_date) where not done;

create or replace function public.guard_case_deadline()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select c.user_id into v_owner from public.cases c where c.id = new.case_id;
  if v_owner is null then raise exception 'Věc neexistuje.'; end if;

  -- Odpovědná osoba: vlastník věci nebo člen sdílené věci
  if new.assignee_id is not null and new.assignee_id <> v_owner
     and not exists (select 1 from public.case_members m where m.case_id = new.case_id and m.user_id = new.assignee_id) then
    raise exception 'Úkol lze přiřadit jen vlastníkovi věci nebo kolegovi, se kterým je věc sdílená.';
  end if;

  -- Poptávka jen od stejného advokáta (vlastníka věci)
  if new.inquiry_id is not null and (tg_op = 'INSERT' or new.inquiry_id is distinct from old.inquiry_id)
     and not exists (select 1 from public.lawyer_inquiries q where q.id = new.inquiry_id and q.user_id = v_owner) then
    raise exception 'Poptávku nelze navázat na cizí věc.';
  end if;

  -- Potvrzení: kdo a kdy určuje server, ne prohlížeč
  if new.confirmed_at is null then
    new.confirmed_by := null;
  elsif tg_op = 'INSERT' or old.confirmed_at is null or new.confirmed_at is distinct from old.confirmed_at then
    -- nové potvrzení (aplikace pošle novou hodnotu): kdo a kdy určí server
    new.confirmed_at := now();
    new.confirmed_by := coalesce(auth.uid(), new.user_id);
  elsif new.due_date is distinct from old.due_date or new.kind is distinct from old.kind then
    -- změna data bez nového potvrzení: dřívější potvrzení už neplatí
    new.confirmed_at := null;
    new.confirmed_by := null;
  else
    new.confirmed_at := old.confirmed_at;
    new.confirmed_by := old.confirmed_by;
  end if;

  -- Čas splnění
  if new.done and (tg_op = 'INSERT' or not old.done) then new.done_at := now();
  elsif not new.done then new.done_at := null;
  elsif tg_op = 'UPDATE' then new.done_at := old.done_at;
  end if;
  return new;
end; $$;
revoke all on function public.guard_case_deadline() from public, anon, authenticated;

drop trigger if exists guard_case_deadline on public.case_deadlines;
create trigger guard_case_deadline before insert or update on public.case_deadlines
for each row execute function public.guard_case_deadline();

-- Kolegové u sdílené věci (pro výběr odpovědné osoby). Vidí je jen ten, kdo věc smí číst.
create or replace function public.case_people(p_case uuid)
returns table (user_id uuid, name text, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select c.user_id, coalesce(nullif(la.display_name, ''), nullif(la.firm_name, ''), la.email, 'Vlastník'), true
    from public.cases c left join public.lawyer_access la on la.user_id = c.user_id
   where c.id = p_case and public.can_read_case(p_case)
  union all
  select m.user_id, coalesce(nullif(la.display_name, ''), nullif(la.firm_name, ''), la.email, 'Kolega'), false
    from public.case_members m left join public.lawyer_access la on la.user_id = m.user_id
   where m.case_id = p_case and public.can_read_case(p_case);
$$;
revoke all on function public.case_people(uuid) from public, anon;
grant execute on function public.case_people(uuid) to authenticated;

insert into public.schema_migrations (name) values ('20261117_01_ukoly-a-potvrzeni-lhut') on conflict do nothing;

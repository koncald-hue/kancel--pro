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

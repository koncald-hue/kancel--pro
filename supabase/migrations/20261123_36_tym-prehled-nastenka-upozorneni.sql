-- =====================================================================
-- 20261123_36  TÝM: PŘEHLED PRO VEDOUCÍHO, NÁSTĚNKA KANCELÁŘE, OKAMŽITÁ UPOZORNĚNÍ
-- Spusť v Supabase Kanceláře (SQL Editor -> New query -> vložit -> Run). Jde spustit i opakovaně.
-- Předpoklady: firms.sql, 20261118_21 (team_tasks, calendar_events), 20261118_19 (substitutions).
--
-- 1) Upozornění (zvoneček): nový úkol od kolegy, splněný / odmítnutý úkol, pozvánka do kalendáře,
--    změna termínu, nový příspěvek na nástěnce. Vznikají v databázi samy, nikdo je nemůže podvrhnout.
-- 2) Nástěnka kanceláře: oznámení a směrnice od vedoucího; u směrnice potvrzuje každý „Přečetl(a) jsem“.
-- 3) Přehled týmu: adresář pro všechny, vedoucí navíc vidí počty otevřených a zpožděných úkolů,
--    dnešní události a nepřítomnost. Jen počty, ne obsah: data členů zůstávají jejich.
-- =====================================================================

-- ---------- 1) Upozornění ----------
create table if not exists public.team_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,      -- komu
  actor_id uuid references auth.users(id) on delete set null,              -- kdo akci udělal
  kind text not null check (kind in ('task', 'task_done', 'task_declined', 'event', 'event_moved', 'post')),
  title text not null check (char_length(title) <= 240),
  link text not null default '/kancelar' check (link like '/kancelar%'),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  pushed_at timestamptz
);
create index if not exists team_notifications_user_idx on public.team_notifications (user_id, seen_at, created_at desc);
create index if not exists team_notifications_actor_idx on public.team_notifications (actor_id, pushed_at, created_at);
alter table public.team_notifications enable row level security;
drop policy if exists "team_notifications_select" on public.team_notifications;
create policy "team_notifications_select" on public.team_notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "team_notifications_update" on public.team_notifications;
create policy "team_notifications_update" on public.team_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on table public.team_notifications from anon, authenticated;
grant select, update (seen_at) on public.team_notifications to authenticated;

create or replace function public.notify_team(p_user uuid, p_kind text, p_title text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  insert into public.team_notifications (user_id, actor_id, kind, title, link) values (p_user, auth.uid(), p_kind, left(p_title, 240), p_link);
end; $$;
revoke all on function public.notify_team(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.team_actor_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name, ''), nullif(register_name, ''), email, 'Kolega') from public.lawyer_access where user_id = auth.uid();
$$;
revoke all on function public.team_actor_name() from public, anon, authenticated;

create or replace function public.team_tasks_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare who text := coalesce(public.team_actor_name(), 'Kolega');
begin
  if tg_op = 'INSERT' then
    perform public.notify_team(new.assignee_id, 'task', who || ' vám zadal(a) úkol: ' || new.title || ' (do ' || to_char(new.due_date, 'DD.MM.') || ')', '/kancelar/ukoly');
  elsif new.assignee_id <> old.assignee_id then
    perform public.notify_team(new.assignee_id, 'task', who || ' vám předal(a) úkol: ' || new.title, '/kancelar/ukoly');
  elsif new.status <> old.status and new.status in ('done', 'declined') then
    perform public.notify_team(new.created_by, case when new.status = 'done' then 'task_done' else 'task_declined' end,
      who || case when new.status = 'done' then ' splnil(a) úkol: ' else ' odmítl(a) úkol: ' end || new.title, '/kancelar/ukoly');
  end if;
  return new;
end; $$;
drop trigger if exists team_tasks_notify_trg on public.team_tasks;
create trigger team_tasks_notify_trg after insert or update on public.team_tasks for each row execute function public.team_tasks_notify();

create or replace function public.calendar_events_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare who text := coalesce(public.team_actor_name(), 'Kolega'); a uuid; whenx text;
begin
  whenx := to_char(new.starts_at at time zone 'Europe/Prague', case when new.all_day then 'DD.MM.' else 'DD.MM. HH24:MI' end);
  foreach a in array new.attendees loop
    if a = new.user_id then continue; end if;
    if tg_op = 'INSERT' or not (a = any(old.attendees)) then
      perform public.notify_team(a, 'event', who || ' vás přidal(a) do kalendáře: ' || new.title || ', ' || whenx, '/kancelar/kalendar');
    elsif new.starts_at <> old.starts_at or new.ends_at <> old.ends_at then
      perform public.notify_team(a, 'event_moved', 'Změna termínu: ' || new.title || ', nově ' || whenx, '/kancelar/kalendar');
    end if;
  end loop;
  return new;
end; $$;
drop trigger if exists calendar_events_notify_trg on public.calendar_events;
create trigger calendar_events_notify_trg after insert or update on public.calendar_events for each row execute function public.calendar_events_notify();

-- ---------- 2) Nástěnka ----------
create table if not exists public.firm_posts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'oznameni' check (kind in ('oznameni', 'smernice')),
  title text not null check (char_length(title) between 2 and 160),
  body text not null default '' check (char_length(body) <= 5000),
  requires_ack boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists firm_posts_firm_idx on public.firm_posts (firm_id, created_at desc);
create table if not exists public.firm_post_acks (
  post_id uuid not null references public.firm_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace function public.my_firm_id() returns uuid language sql stable security definer set search_path = public as $$
  select firm_id from public.firm_members where user_id = auth.uid();
$$;
create or replace function public.is_firm_manager() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.firm_members where user_id = auth.uid() and role in ('owner', 'admin'));
$$;
revoke all on function public.my_firm_id() from public, anon;
revoke all on function public.is_firm_manager() from public, anon;
grant execute on function public.my_firm_id() to authenticated;
grant execute on function public.is_firm_manager() to authenticated;

alter table public.firm_posts enable row level security;
alter table public.firm_post_acks enable row level security;
drop policy if exists "firm_posts_select" on public.firm_posts;
create policy "firm_posts_select" on public.firm_posts for select to authenticated using (firm_id = public.my_firm_id());
drop policy if exists "firm_posts_insert" on public.firm_posts;
create policy "firm_posts_insert" on public.firm_posts for insert to authenticated with check (firm_id = public.my_firm_id() and author_id = auth.uid() and public.is_firm_manager());
drop policy if exists "firm_posts_update" on public.firm_posts;
create policy "firm_posts_update" on public.firm_posts for update to authenticated using (firm_id = public.my_firm_id() and public.is_firm_manager()) with check (firm_id = public.my_firm_id());
drop policy if exists "firm_posts_delete" on public.firm_posts;
create policy "firm_posts_delete" on public.firm_posts for delete to authenticated using (firm_id = public.my_firm_id() and public.is_firm_manager());
drop policy if exists "firm_post_acks_select" on public.firm_post_acks;
create policy "firm_post_acks_select" on public.firm_post_acks for select to authenticated using (
  user_id = auth.uid() or (public.is_firm_manager() and exists (select 1 from public.firm_posts p where p.id = post_id and p.firm_id = public.my_firm_id())));
drop policy if exists "firm_post_acks_insert" on public.firm_post_acks;
create policy "firm_post_acks_insert" on public.firm_post_acks for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.firm_posts p where p.id = post_id and p.firm_id = public.my_firm_id()));
revoke all on table public.firm_posts, public.firm_post_acks from anon;
grant select, insert, update, delete on public.firm_posts to authenticated;
grant select, insert on public.firm_post_acks to authenticated;

create or replace function public.firm_posts_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from public.firm_members where firm_id = new.firm_id and user_id <> new.author_id loop
    perform public.notify_team(m.user_id, 'post', case when new.requires_ack then 'Na nástěnce je nová směrnice k potvrzení: ' else 'Nové oznámení na nástěnce: ' end || new.title, '/kancelar#nastenka');
  end loop;
  return new;
end; $$;
drop trigger if exists firm_posts_notify_trg on public.firm_posts;
create trigger firm_posts_notify_trg after insert on public.firm_posts for each row execute function public.firm_posts_notify();

-- ---------- 3) Přehled týmu ----------
-- Adresář vidí každý člen; počty úkolů, dnešní události a nepřítomnost jen vedoucí (a správce)
create or replace function public.team_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_firm uuid := public.my_firm_id(); v_mgr boolean := public.is_firm_manager(); v_today date := (now() at time zone 'Europe/Prague')::date;
begin
  if v_firm is null then return null; end if;
  return jsonb_build_object('manager', v_mgr, 'members', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'name', coalesce(nullif(la.display_name, ''), nullif(la.register_name, ''), la.email, ''),
      'email', coalesce(nullif(la.contact_email, ''), la.email, ''),
      'phone', coalesce(la.phone, ''),
      'role', m.role,
      'trainee', coalesce((to_jsonb(m) ->> 'trainee')::boolean, false),
      'avatar', la.avatar_small,
      'open_tasks', case when v_mgr then (select count(*) from public.team_tasks t where t.assignee_id = m.user_id and t.status = 'open') end,
      'overdue_tasks', case when v_mgr then (select count(*) from public.team_tasks t where t.assignee_id = m.user_id and t.status = 'open' and t.due_date < v_today) end,
      'today_events', case when v_mgr then (select count(*) from public.calendar_events e where (e.user_id = m.user_id or m.user_id = any(e.attendees))
          and (e.starts_at at time zone 'Europe/Prague')::date <= v_today and (e.ends_at at time zone 'Europe/Prague')::date >= v_today) end,
      'absent', case when v_mgr then exists (select 1 from public.substitutions s where s.user_id = m.user_id and v_today between s.from_on and s.to_on) end
    ) order by (m.role = 'owner') desc, coalesce(nullif(la.display_name, ''), la.email)), '[]'::jsonb)
    from public.firm_members m left join public.lawyer_access la on la.user_id = m.user_id
    where m.firm_id = v_firm));
end; $$;
revoke all on function public.team_overview() from public, anon;
grant execute on function public.team_overview() to authenticated;

insert into public.schema_migrations (name) values ('20261123_36_tym-prehled-nastenka-upozorneni') on conflict do nothing;

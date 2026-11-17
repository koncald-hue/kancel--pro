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

-- A shared editor may change case content, never transfer the case owner.
create or replace function public.guard_case_owner_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and new.user_id is distinct from old.user_id then
    raise exception 'Vlastníka věci nelze změnit běžnou úpravou.';
  end if;
  return new;
end; $$;
drop trigger if exists guard_case_owner_immutable on public.cases;
create trigger guard_case_owner_immutable before update on public.cases
for each row execute function public.guard_case_owner_immutable();


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

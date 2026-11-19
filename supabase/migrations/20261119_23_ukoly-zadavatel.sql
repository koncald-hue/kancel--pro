-- =====================================================================
-- 20261119_23  ÚKOLY: ZADAVATELE NELZE ZMĚNIT (oprava z kontroly kódu)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Kdo úkol zadal, mohl dosud v úkolu přepsat pole „zadal“ na kolegu a sebe nastavit jako řešitele.
-- Úkol by pak vypadal, že ho zadal kolega. Teď databáze změnu zadavatele odmítne.
-- =====================================================================

create or replace function public.team_tasks_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.case_id is not null then select left(title, 200) into new.case_title from public.cases where id = new.case_id; end if;
    new.status := 'open'; new.done_at := null; new.answer := ''; new.seen_at := case when new.assignee_id = new.created_by then now() else null end;
    return new;
  end if;
  -- Zadavatele nelze změnit (jinak by šlo předstírat, že úkol zadal kolega)
  if new.created_by <> old.created_by then raise exception 'Zadavatele úkolu nelze změnit.'; end if;
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

insert into public.schema_migrations (name) values ('20261119_23_ukoly-zadavatel') on conflict do nothing;

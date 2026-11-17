-- =====================================================================
-- AUTOMATICKÝ NÁVRH VÝKAZU PRÁCE („stopa práce“)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné lawyer.sql, case-files.sql, client-portal.sql a podpisy-a-aml.sql.
--
-- work_activity: co advokát v aplikaci udělal (bez obsahu dokumentů a zpráv, jen druh úkonu, věc, čas a případně název).
-- Z toho aplikace navrhne výkaz; zapíše se teprve po potvrzení advokátem. Záznamy vidí jen jejich autor.
-- =====================================================================
create table if not exists public.work_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  kind text not null check (kind in ('email_read', 'email_sent', 'datovka_read', 'document_created', 'file_opened', 'file_added', 'entry_added', 'deadline_added', 'client_message', 'signature_request')),
  label text not null default '' check (char_length(label) <= 200),
  ref text not null default '' check (char_length(ref) <= 200),
  words integer not null default 0 check (words >= 0),
  at timestamptz not null default now(),
  time_entry_id uuid references public.time_entries(id) on delete set null,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists work_activity_user_idx on public.work_activity (user_id, at desc);
create index if not exists work_activity_ref_idx on public.work_activity (user_id, ref) where ref <> '';
alter table public.work_activity enable row level security;
drop policy if exists "work_activity_own" on public.work_activity;
create policy "work_activity_own" on public.work_activity for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Úkony uložené v databázi se zapíší samy. Zapisuje se za přihlášeného uživatele, takže portál klienta (bez přihlášení) nic nezapíše.
create or replace function public.log_work_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text; v_label text := ''; v_words int := 0; v_case uuid;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'case_entries' then
    -- Automatické zápisy (např. upozornění radaru) nejsou práce advokáta
    if new.title like 'Radar:%' then return new; end if;
    v_kind := 'entry_added'; v_case := new.case_id; v_label := left(new.title, 200);
    v_words := coalesce(array_length(regexp_split_to_array(btrim(new.title || ' ' || coalesce(new.body, '')), '\s+'), 1), 0);
  elsif tg_table_name = 'case_deadlines' then
    if new.import_batch is not null then return new; end if;
    v_kind := 'deadline_added'; v_case := new.case_id; v_label := left(new.title, 200);
  elsif tg_table_name = 'case_files' then
    if coalesce(new.source, '') = 'client' then return new; end if;
    v_kind := 'file_added'; v_case := new.case_id;
  elsif tg_table_name = 'client_messages' then
    if new.from_client then return new; end if;
    v_kind := 'client_message'; v_case := new.case_id;
    -- Šifrovaná zpráva: délka se odhadne z velikosti šifrovaného textu
    v_words := case when new.body like 'e1:%' then greatest(1, char_length(new.body) / 9) else coalesce(array_length(regexp_split_to_array(btrim(new.body), '\s+'), 1), 0) end;
  elsif tg_table_name = 'signature_requests' then
    v_kind := 'signature_request'; v_case := new.case_id; v_label := left(new.title, 200);
  else
    return new;
  end if;
  insert into public.work_activity (user_id, case_id, kind, label, words) values (auth.uid(), v_case, v_kind, v_label, v_words);
  return new;
exception when others then
  -- Stopa práce nesmí nikdy zablokovat samotnou práci
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['case_entries', 'case_deadlines', 'case_files', 'client_messages', 'signature_requests'] loop
    execute format('drop trigger if exists log_work_activity on public.%I', t);
    execute format('create trigger log_work_activity after insert on public.%I for each row execute function public.log_work_activity()', t);
  end loop;
end $$;

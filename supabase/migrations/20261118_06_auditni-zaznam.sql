-- =====================================================================
-- 20261118_06  AUDITNÍ ZÁZNAM: KDO KDY CO VE VĚCI OTEVŘEL NEBO ZMĚNIL
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: sdilene-veci.sql (can_read_case), 20261117_01 (schema_migrations), 20261118_05 (mfa_ok).
--
-- Co zapisuje: vytvoření, změnu a smazání věcí, souborů, chronologie, lhůt, kontaktů, složek, členů sdílení, klientských
-- odkazů, požadavků, zpráv, podpisů, identifikací, nemovitostí, rešerší, datových zpráv, výkazů, faktur a klientů,
-- a (přes funkci log_case_event) otevření věci, stažení souboru a export spisu.
-- Zapisuje se: čas, kdo (uživatel, u klienta přes odkaz je kdo prázdné), věc, druh události, název záznamu a NÁZVY
-- změněných sloupců. Nikdy se nezapisuje obsah (text zpráv, poznámek, souborů, hesla, tokeny).
-- Záznam je jen pro přidávání: tabulka nemá žádnou politiku pro čtení ani zápis uživatelů a spouštěč zakazuje úpravu
-- i mazání. Čte se přes funkci audit_list, která vydá jen události z věcí, které uživatel vlastní nebo smí číst, a svoje.
-- =====================================================================

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  case_id uuid,
  owner_id uuid,
  action text not null check (action in ('vytvoreno', 'zmeneno', 'smazano', 'otevreno', 'stazeno', 'exportovano')),
  entity text not null check (char_length(entity) <= 60),
  entity_id uuid,
  summary text not null default '' check (char_length(summary) <= 300),
  changed text[] not null default '{}'
);
create index if not exists audit_log_case_idx on public.audit_log (case_id, at desc);
create index if not exists audit_log_owner_idx on public.audit_log (owner_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor, at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;
grant all on public.audit_log to service_role;

-- Jen pro přidávání
create or replace function public.audit_log_append_only()
returns trigger language plpgsql as $$
begin raise exception 'Auditní záznam nelze měnit ani mazat.'; end; $$;
drop trigger if exists audit_log_no_change on public.audit_log;
create trigger audit_log_no_change before update or delete on public.audit_log for each row execute function public.audit_log_append_only();

-- Zápis z databázových spouštěčů
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb; o jsonb; v_case uuid; v_owner uuid; v_id uuid; v_sum text; v_changed text[] := '{}'; v_action text; k text;
  v_skip text[] := array['updated_at', 'opens', 'last_opened_at', 'read', 'token', 'wrapped_key', 'enc_cred', 'enc_password', 'evidence', 'evidence_seal'];
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := nullif(r ->> 'id', '')::uuid;
  v_case := case when tg_table_name = 'cases' then v_id else nullif(r ->> 'case_id', '')::uuid end;
  if tg_table_name = 'cases' then v_owner := nullif(r ->> 'user_id', '')::uuid;
  else select c.user_id into v_owner from public.cases c where c.id = v_case; end if;
  if v_owner is null then v_owner := nullif(r ->> 'user_id', '')::uuid; end if;

  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    for k in select jsonb_object_keys(r) loop
      if r -> k is distinct from o -> k and not (k = any (v_skip)) and k not like 'enc\_%' then v_changed := v_changed || k; end if;
    end loop;
    if array_length(v_changed, 1) is null then return null; end if;  -- jen počítadla a podobné šumy
  end if;

  v_action := case tg_op when 'INSERT' then 'vytvoreno' when 'UPDATE' then 'zmeneno' else 'smazano' end;
  -- Souhrn: jen název/označení, u zpráv jen směr; žádný obsah
  v_sum := case
    when tg_table_name = 'client_messages' then case when (r ->> 'from_client')::boolean then 'zpráva od klienta' else 'zpráva klientovi' end
    when tg_table_name = 'case_members' then 'sdílení věci (role ' || coalesce(r ->> 'role', '?') || ')'
    else left(coalesce(nullif(r ->> 'title', ''), nullif(r ->> 'name', ''), nullif(r ->> 'label', ''), nullif(r ->> 'number', ''), nullif(r ->> 'subject', ''), ''), 300)
  end;

  insert into public.audit_log (actor, case_id, owner_id, action, entity, entity_id, summary, changed)
  values (auth.uid(), v_case, v_owner, v_action, tg_table_name, v_id, v_sum, v_changed);
  return null;
end; $$;
revoke all on function public.audit_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['cases', 'case_files', 'case_entries', 'case_deadlines', 'case_contacts', 'case_folders', 'case_members',
    'client_links', 'client_requests', 'client_messages', 'signature_requests', 'client_identifications', 'case_properties',
    'case_research', 'case_data_messages', 'time_entries', 'invoices', 'lawyer_clients'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_row on public.%I', t);
      execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
    end if;
  end loop;
end $$;

-- Otevření věci, stažení souboru, export: zapisuje aplikace (jen pro věc, kterou uživatel smí číst)
create or replace function public.log_case_event(p_case uuid, p_action text, p_entity text default 'cases', p_summary text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null or p_action not in ('otevreno', 'stazeno', 'exportovano') or not public.can_read_case(p_case) then return; end if;
  if p_action = 'otevreno' and exists (select 1 from public.audit_log a where a.actor = auth.uid() and a.case_id = p_case and a.action = 'otevreno' and a.at > now() - interval '10 minutes') then return; end if;
  select c.user_id into v_owner from public.cases c where c.id = p_case;
  insert into public.audit_log (actor, case_id, owner_id, action, entity, summary) values (auth.uid(), p_case, v_owner, p_action, left(coalesce(nullif(p_entity, ''), 'cases'), 60), left(coalesce(p_summary, ''), 300));
end; $$;
revoke all on function public.log_case_event(uuid, text, text, text) from public, anon;
grant execute on function public.log_case_event(uuid, text, text, text) to authenticated;

-- Čtení: události z věcí, které uživatel vlastní nebo smí číst, a jeho vlastní. Jen s druhým faktorem, pokud ho má zapnutý.
create or replace function public.audit_list(p_case uuid default null, p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 1000)
returns table (at timestamptz, actor_name text, case_id uuid, case_title text, action text, entity text, summary text, changed text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.mfa_ok() or not public.has_lawyer_access() then return; end if;
  return query
    select a.at,
           case when a.actor is null then 'klient / systém' else coalesce(nullif(la.display_name, ''), nullif(la.firm_name, ''), la.email, 'neznámý uživatel') end,
           a.case_id, c.title, a.action, a.entity, a.summary, a.changed
      from public.audit_log a
      left join public.lawyer_access la on la.user_id = a.actor
      left join public.cases c on c.id = a.case_id
     where (p_case is null or a.case_id = p_case)
       and (p_from is null or a.at >= p_from) and (p_to is null or a.at <= p_to)
       and (a.owner_id = auth.uid() or a.actor = auth.uid() or (a.case_id is not null and public.can_read_case(a.case_id)))
     order by a.at desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end; $$;
revoke all on function public.audit_list(uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.audit_list(uuid, timestamptz, timestamptz, integer) to authenticated;

insert into public.schema_migrations (name) values ('20261118_06_auditni-zaznam') on conflict do nothing;

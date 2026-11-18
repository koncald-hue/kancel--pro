-- =====================================================================
-- 20261118_10  HLÍDAČ (KATASTR) A DALŠÍ ZDROJE PRO NÁVRH VÝKAZŮ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: katastr.sql, radar.sql, stopa-prace.sql, 20261117_01.
--
-- 1) Hlídání řízení v katastru: uložené řízení (case_properties) lze zapnout k hlídání. Kontrolu spouští aplikace v prohlížeči
--    advokáta (nejvýše jednou za 12 hodin na řízení); změna stavu se zapíše do radaru a do chronologie věci.
-- 2) Událost „změna řízení v katastru“ je nový druh události radaru; jedinečnost zajišťuje index (věc, druh, odkaz) pro události bez kontaktu.
-- 3) Návrh výkazu zná nový úkon „splnění úkolu“ (zapíše se, když advokát úkol označí za hotový).
-- Existující data se nemění.
-- =====================================================================
alter table public.case_properties add column if not exists watch boolean not null default false;
alter table public.case_properties add column if not exists watch_checked_at timestamptz;
alter table public.case_properties add column if not exists watch_error text not null default '' check (char_length(watch_error) <= 300);
create index if not exists case_properties_watch_idx on public.case_properties (user_id) where watch;

alter table public.radar_events drop constraint if exists radar_events_kind_check;
alter table public.radar_events add constraint radar_events_kind_check check (kind in ('insolvence', 'insolvence_konec', 'likvidace', 'zanik', 'zmena_nazvu', 'zmena_sidla', 'katastr_rizeni'));
create unique index if not exists radar_events_prop_unique on public.radar_events (case_id, kind, ref) where contact_id is null;

alter table public.work_activity drop constraint if exists work_activity_kind_check;
alter table public.work_activity add constraint work_activity_kind_check check (kind in ('email_read', 'email_sent', 'datovka_read', 'document_created', 'file_opened', 'file_added', 'entry_added', 'deadline_added', 'deadline_done', 'client_message', 'signature_request'));

create or replace function public.log_work_activity_done()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not new.done or coalesce(old.done, false) then return new; end if;
  if new.import_batch is not null then return new; end if;
  insert into public.work_activity (user_id, case_id, kind, label) values (auth.uid(), new.case_id, 'deadline_done', left(new.title, 200));
  return new;
exception when others then
  return new;  -- stopa práce nesmí zablokovat samotnou práci
end; $$;
revoke all on function public.log_work_activity_done() from public, anon, authenticated;
drop trigger if exists log_work_activity_done on public.case_deadlines;
create trigger log_work_activity_done after update of done on public.case_deadlines for each row execute function public.log_work_activity_done();

insert into public.schema_migrations (name) values ('20261118_10_hlidac-a-vykazy') on conflict do nothing;

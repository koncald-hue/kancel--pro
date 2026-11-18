-- =====================================================================
-- 20261118_12  VÝCHOZÍ ŠABLONA ÚKOLŮ (použije se automaticky u každé nové věci)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklad: 20261118_11 (case_templates).
-- =====================================================================
alter table public.case_templates add column if not exists is_default boolean not null default false;
-- Nejvýš jedna výchozí šablona na uživatele
create unique index if not exists case_templates_one_default on public.case_templates (user_id) where is_default;

insert into public.schema_migrations (name) values ('20261118_12_vychozi-sablona') on conflict do nothing;

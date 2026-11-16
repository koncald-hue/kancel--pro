-- Základní sada vzorů: u vzoru se uchová jeho původ a poznámka „Co zkontrolovat před použitím“.
-- Spusť JEDNOU v Supabase SQL Editoru po poptavky-prilohy.sql. Jde spustit i opakovaně.
alter table public.lawyer_templates add column if not exists starter_id text;
alter table public.lawyer_templates add column if not exists note text not null default '' check (char_length(note) <= 2000);
create index if not exists lawyer_templates_starter_idx on public.lawyer_templates (user_id, starter_id) where starter_id is not null;

-- =====================================================================
-- PŘÍLOHY K POPTÁVCE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Zájemce může k poptávce přiložit dokumenty. Do spisu se dostanou až po PŘIJETÍ poptávky;
-- do té doby leží odděleně v soukromém úložišti inquiry-files a vidí je jen adresovaný advokát.
-- Při odmítnutí poptávky se přílohy smažou.
-- =====================================================================
create table if not exists public.inquiry_files (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.lawyer_inquiries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null,
  size bigint not null default 0,
  mime text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists inquiry_files_inquiry_idx on public.inquiry_files (inquiry_id);
alter table public.inquiry_files enable row level security;
drop policy if exists "inquiry_files: select" on public.inquiry_files;
create policy "inquiry_files: select" on public.inquiry_files for select to authenticated using (user_id = auth.uid());
drop policy if exists "inquiry_files: delete" on public.inquiry_files;
create policy "inquiry_files: delete" on public.inquiry_files for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('inquiry-files', 'inquiry-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "inquiry-files: vlastnik" on storage.objects;
create policy "inquiry-files: vlastnik" on storage.objects
  for all to authenticated
  using (bucket_id = 'inquiry-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'inquiry-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- VLASTNÍ VZORY DOKUMENTŮ S POLI
-- Text vzoru obsahuje pole ve složených závorkách, např. {{klient.jmeno}}. Počítač je vyplní z věci a klienta,
-- ostatní pole (např. {{castka}}) se při vyplňování zeptají na hodnotu.
-- =====================================================================
create table if not exists public.lawyer_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  category text not null default '' check (char_length(category) <= 60),
  body text not null default '' check (char_length(body) <= 60000),
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lawyer_templates enable row level security;
drop policy if exists "templates: select" on public.lawyer_templates;
create policy "templates: select" on public.lawyer_templates for select to authenticated
  using (user_id = auth.uid() or (shared and public.same_firm(auth.uid(), user_id)));
drop policy if exists "templates: insert" on public.lawyer_templates;
create policy "templates: insert" on public.lawyer_templates for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "templates: update" on public.lawyer_templates;
create policy "templates: update" on public.lawyer_templates for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "templates: delete" on public.lawyer_templates;
create policy "templates: delete" on public.lawyer_templates for delete to authenticated using (user_id = auth.uid());

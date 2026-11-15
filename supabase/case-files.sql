-- =====================================================================
-- SPIS PŘÍPADU: soubory, složky, chronologie, vlastní lhůty a kontakty
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné cases.sql. Každý uživatel vidí jen své vlastní záznamy a soubory.
-- =====================================================================

-- Složky ve spisu
create table if not exists public.case_folders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Soubory (samotný soubor je v úložišti case-files pod cestou <user_id>/<case_id>/...)
create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  folder_id uuid references public.case_folders(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null,
  size bigint not null default 0,
  mime text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Chronologie a poznámky: kind = 'event' (co se kdy stalo) nebo 'note' (poznámka)
create table if not exists public.case_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'event' check (kind in ('event', 'note')),
  title text not null,
  body text not null default '',
  happened_on date,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Vlastní lhůty a termíny (jednání, splatnost, odvolání…)
create table if not exists public.case_deadlines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Kontakty (úřad, soud, advokát, protistrana)
create table if not exists public.case_contacts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default '',
  name text not null,
  email text not null default '',
  phone text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists case_folders_case_idx on public.case_folders (case_id);
create index if not exists case_files_case_idx on public.case_files (case_id, created_at desc);
create index if not exists case_entries_case_idx on public.case_entries (case_id, happened_on desc);
create index if not exists case_deadlines_case_idx on public.case_deadlines (case_id, due_date);
create index if not exists case_contacts_case_idx on public.case_contacts (case_id);

-- Práva: každý smí jen své řádky
do $$
declare t text;
begin
  foreach t in array array['case_folders', 'case_files', 'case_entries', 'case_deadlines', 'case_contacts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Dodatečné sloupce u případu: zda je případ připnutý nahoře
alter table public.cases add column if not exists pinned boolean not null default false;

-- Soukromé úložiště souborů spisu (max. 15 MB na soubor)
insert into storage.buckets (id, name, public, file_size_limit)
values ('case-files', 'case-files', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists "case-files: vlastnik" on storage.objects;
create policy "case-files: vlastnik" on storage.objects
  for all to authenticated
  using (bucket_id = 'case-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'case-files' and (storage.foldername(name))[1] = auth.uid()::text);

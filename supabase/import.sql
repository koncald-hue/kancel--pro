-- =====================================================================
-- IMPORT DAT (klienti, věci, lhůty, kontakty, čas) A JEHO VRÁCENÍ ZPĚT
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné lawyer.sql, case-files.sql, fakturace.sql a zruseni-a-zamek.sql.
-- Každý import je „dávka“; záznamy z dávky mají import_batch, takže jdou jedním krokem smazat.
-- =====================================================================
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('klienti', 'veci', 'lhuty', 'kontakty', 'cas')),
  source text not null default '' check (char_length(source) <= 200),
  counts jsonb not null default '{}'::jsonb,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.import_batches enable row level security;
drop policy if exists "import_batches_own" on public.import_batches;
create policy "import_batches_own" on public.import_batches for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['lawyer_clients', 'cases', 'case_deadlines', 'case_contacts', 'time_entries'] loop
    execute format('alter table public.%I add column if not exists import_batch uuid references public.import_batches(id) on delete set null', t);
    execute format('create index if not exists %I on public.%I (import_batch) where import_batch is not null', t || '_import_idx', t);
  end loop;
  execute 'drop trigger if exists lock_when_expired on public.import_batches';
  execute 'create trigger lock_when_expired before insert or update or delete on public.import_batches for each row execute function public.block_when_locked()';
end $$;

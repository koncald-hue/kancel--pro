-- =====================================================================
-- PRÁVNÍ REŠERŠE (DirectCase)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné zruseni-a-zamek.sql.
--
-- legal_connections: přihlášení advokáta k jeho účtu DirectCase. Tokeny jsou uložené JEN zašifrované šifrovacím heslem
--   advokáta (end-to-end, předpona e1:), server je nezná.
-- case_research: uložené rešerše u věcí (otázka, nalezené zdroje a vyhodnocení). Vstup je anonymizovaný.
-- =====================================================================
create table if not exists public.legal_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'directcase',
  client_id text not null,
  enc_token text not null check (enc_token like 'e1:%'),
  updated_at timestamptz not null default now()
);
alter table public.legal_connections enable row level security;
drop policy if exists "legal_connections_own" on public.legal_connections;
create policy "legal_connections_own" on public.legal_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.case_research (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 1500),
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists case_research_case_idx on public.case_research (case_id, created_at desc);
alter table public.case_research enable row level security;
drop policy if exists "case_research_select" on public.case_research;
create policy "case_research_select" on public.case_research for select using (user_id = auth.uid());
drop policy if exists "case_research_insert" on public.case_research;
create policy "case_research_insert" on public.case_research for insert with check (user_id = auth.uid() and exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
drop policy if exists "case_research_delete" on public.case_research;
create policy "case_research_delete" on public.case_research for delete using (user_id = auth.uid());

drop trigger if exists lock_when_expired on public.case_research;
create trigger lock_when_expired before insert or update or delete on public.case_research for each row execute function public.block_when_locked();
drop trigger if exists lock_when_expired on public.legal_connections;
create trigger lock_when_expired before insert or update or delete on public.legal_connections for each row execute function public.block_when_locked();

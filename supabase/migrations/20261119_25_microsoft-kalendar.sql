-- =====================================================================
-- 20261119_25  KALENDÁŘ MICROSOFT 365 / OUTLOOK
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- ms_connections: přihlášení advokáta k Microsoftu. Tokeny jsou uložené JEN zašifrované šifrovacím heslem advokáta (e1:), server je nezná.
-- ms_calendar_sync: které události v kalendáři patří ke kterým lhůtám (aby šly upravit nebo smazat).
-- =====================================================================
create table if not exists public.ms_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calendar_id text not null,
  detail text not null default 'minimal' check (detail in ('minimal', 'vec', 'plne')),
  internal boolean not null default true,
  enc_token text not null check (enc_token like 'e1:%'),
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ms_connections enable row level security;
drop policy if exists "ms_connections_own" on public.ms_connections;
create policy "ms_connections_own" on public.ms_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.ms_calendar_sync (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('main', 'internal')),
  event_id text not null,
  hash text not null,
  primary key (user_id, key, kind)
);
alter table public.ms_calendar_sync enable row level security;
drop policy if exists "ms_calendar_sync_own" on public.ms_calendar_sync;
create policy "ms_calendar_sync_own" on public.ms_calendar_sync for all using (user_id = auth.uid()) with check (user_id = auth.uid());

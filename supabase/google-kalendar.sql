-- =====================================================================
-- GOOGLE KALENDÁŘ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
--
-- google_connections: přihlášení advokáta ke Googlu. Tokeny jsou uložené JEN zašifrované šifrovacím heslem advokáta (e1:),
--   server je nezná. Aplikace si u Googlu vytvoří vlastní kalendář a vidí jen ten.
-- google_calendar_sync: které události v kalendáři patří ke kterým lhůtám (aby šly upravit nebo smazat).
-- =====================================================================
create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calendar_id text not null,
  detail text not null default 'minimal' check (detail in ('minimal', 'vec', 'plne')),
  internal boolean not null default true,
  enc_token text not null check (enc_token like 'e1:%'),
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.google_connections enable row level security;
drop policy if exists "google_connections_own" on public.google_connections;
create policy "google_connections_own" on public.google_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.google_calendar_sync (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('main', 'internal')),
  event_id text not null,
  hash text not null,
  primary key (user_id, key, kind)
);
alter table public.google_calendar_sync enable row level security;
drop policy if exists "google_calendar_sync_own" on public.google_calendar_sync;
create policy "google_calendar_sync_own" on public.google_calendar_sync for all using (user_id = auth.uid()) with check (user_id = auth.uid());

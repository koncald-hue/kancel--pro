-- =====================================================================
-- KANCELÁŘ (sekce Pro advokáty): přístup, klienti a výkazy práce
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run (zvol "Run and enable RLS").
-- Nejdřív musí být spuštěné cases.sql a 00-zaklad.sql (kvůli is_staff()).
--
-- Přístup: uživatel si sám zahájí 14denní zkušební přístup nebo o přístup požádá;
-- placený přístup aktivuje tým ve Správě (zatím ručně, než bude platební brána).
-- =====================================================================

create table if not exists public.lawyer_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  status text not null default 'trial' check (status in ('trial', 'active', 'requested', 'expired')),
  until date,
  firm_name text not null default '',
  default_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lawyer_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  note text not null default '',
  hourly_rate numeric,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  entry_date date not null default current_date,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  description text not null default '',
  rate numeric not null default 0,
  billed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_user_idx on public.time_entries (user_id, entry_date desc);

alter table public.lawyer_access enable row level security;
alter table public.lawyer_clients enable row level security;
alter table public.time_entries enable row level security;

-- Přístup: čte vlastní řádek (tým všechny); zahájit lze jen zkušební přístup (max. 14 dní) nebo žádost
drop policy if exists "lawyer_access_select" on public.lawyer_access;
create policy "lawyer_access_select" on public.lawyer_access for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "lawyer_access_insert" on public.lawyer_access;
create policy "lawyer_access_insert" on public.lawyer_access for insert with check (
  auth.uid() = user_id
  and status in ('trial', 'requested')
  and (status <> 'trial' or until <= current_date + 14)
);
drop policy if exists "lawyer_access_staff_update" on public.lawyer_access;
create policy "lawyer_access_staff_update" on public.lawyer_access for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "lawyer_access_staff_delete" on public.lawyer_access;
create policy "lawyer_access_staff_delete" on public.lawyer_access for delete using (public.is_staff());

-- Název kanceláře a výchozí sazbu si mění uživatel sám (stav a platnost jen tým)
create or replace function public.update_lawyer_profile(p_firm text, p_rate numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lawyer_access set firm_name = left(coalesce(p_firm, ''), 120), default_rate = greatest(coalesce(p_rate, 0), 0)
  where user_id = auth.uid();
$$;
revoke all on function public.update_lawyer_profile(text, numeric) from public;
grant execute on function public.update_lawyer_profile(text, numeric) to authenticated;

drop policy if exists "lawyer_clients_own" on public.lawyer_clients;
create policy "lawyer_clients_own" on public.lawyer_clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "time_entries_own" on public.time_entries;
create policy "time_entries_own" on public.time_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert on public.lawyer_access to authenticated;
grant update, delete on public.lawyer_access to authenticated;
grant select, insert, update, delete on public.lawyer_clients, public.time_entries to authenticated;

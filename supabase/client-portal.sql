-- =====================================================================
-- KLIENTSKÝ ODKAZ A POPTÁVKY (sekce Pro advokáty)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run (zvol "Run and enable RLS").
-- Nejdřív musí být spuštěné cases.sql, case-files.sql a lawyer.sql.
--
-- Klient bez účtu pracuje přes soukromý odkaz. Všechny jeho požadavky jdou přes server
-- webu (klíč SUPABASE_SERVICE_ROLE_KEY), nikdy přímo do databáze. Samotná data zůstávají
-- chráněná pravidly přístupu: čte a mění je jen jejich majitel (advokát).
-- =====================================================================

-- Odkaz pro klienta k jedné věci
create table if not exists public.client_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,                 -- náhodných 256 bitů; kdo ho zná, má přístup
  label text not null default '',             -- název věci pro klienta
  status_text text not null default '',       -- aktuální stav věci jednou větou
  expires_at timestamptz,
  revoked boolean not null default false,
  opens integer not null default 0,
  last_opened_at timestamptz,
  created_at timestamptz not null default now()
);

-- Co advokát od klienta potřebuje (seznam podkladů)
create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Zprávy mezi klientem a advokátem u věci
create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_client boolean not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Poptávky od budoucích klientů přes veřejný odkaz kanceláře
create table if not exists public.lawyer_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  message text not null,
  status text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- Viditelnost pro klienta a původ souboru
alter table public.case_files add column if not exists client_visible boolean not null default false;
alter table public.case_files add column if not exists source text not null default 'lawyer';
alter table public.case_files add column if not exists request_id uuid;
alter table public.case_entries add column if not exists client_visible boolean not null default false;
alter table public.case_deadlines add column if not exists client_visible boolean not null default false;

-- Veřejný kód poptávkového odkazu kanceláře
alter table public.lawyer_access add column if not exists intake_code text;
create unique index if not exists lawyer_access_intake_code_idx on public.lawyer_access (intake_code) where intake_code is not null;

create index if not exists client_links_case_idx on public.client_links (case_id);
create index if not exists client_requests_case_idx on public.client_requests (case_id);
create index if not exists client_messages_case_idx on public.client_messages (case_id, created_at);
create index if not exists lawyer_inquiries_user_idx on public.lawyer_inquiries (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['client_links', 'client_requests', 'client_messages', 'lawyer_inquiries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Kód poptávkového odkazu si advokát nastavuje sám (jen u svého řádku)
create or replace function public.set_intake_code(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lawyer_access set intake_code = nullif(left(p_code, 40), '') where user_id = auth.uid();
$$;
revoke all on function public.set_intake_code(text) from public;
grant execute on function public.set_intake_code(text) to authenticated;

-- =====================================================================
-- ELEKTRONICKÝ PODPIS V KLIENTSKÉM PORTÁLU A IDENTIFIKACE KLIENTA (AML)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné client-portal.sql, case-files.sql, lawyer.sql a zruseni-a-zamek.sql.
--
-- signature_requests: žádost o podpis dokumentu (pokročilý podpis v aplikaci, nebo kvalifikovaný mimo ni).
--   Doklad o podpisu (evidence) a jeho pečeť zapisuje JEN server (service role); advokát je může číst, ne měnit.
-- signature_otps, identity_sessions: pomocné tabulky serveru, bez přístupu z prohlížeče.
-- client_identifications: identifikace klienta pro zákon č. 253/2008 Sb. (vyplňuje a potvrzuje advokát).
-- =====================================================================
create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  file_id uuid references public.case_files(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'jine' check (kind in ('smlouva', 'souhlas', 'protokol', 'plna_moc', 'podani', 'jine')),
  level text not null default 'advanced' check (level in ('advanced', 'qualified')),
  identity_method text not null default 'bankid' check (identity_method in ('bankid', 'lawyer', 'none')),
  identity_note text not null default '' check (char_length(identity_note) <= 400),
  doc_sha256 text not null check (doc_sha256 ~ '^[0-9a-f]{64}$'),
  signer_name text not null default '' check (char_length(signer_name) <= 160),
  signer_phone text not null default '' check (char_length(signer_phone) <= 40),
  status text not null default 'pending' check (status in ('pending', 'signed', 'awaiting_check', 'declined', 'cancelled', 'expired')),
  expires_at timestamptz,
  signed_at timestamptz,
  evidence jsonb,
  evidence_seal text,
  external_file_id uuid references public.case_files(id) on delete set null,
  decline_reason text not null default '' check (char_length(decline_reason) <= 400),
  created_at timestamptz not null default now()
);
create index if not exists signature_requests_case_idx on public.signature_requests (case_id, created_at desc);
alter table public.signature_requests enable row level security;
drop policy if exists "signature_requests_own" on public.signature_requests;
create policy "signature_requests_own" on public.signature_requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Advokát nesmí upravit podepsaný doklad ani se podepsat za klienta. Povolené je jen zrušení nepodepsané žádosti,
-- potvrzení externě podepsaného dokumentu a smazání žádosti, která nebyla podepsána.
create or replace function public.guard_signature_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status in ('signed') then raise exception 'Podepsaný dokument nelze smazat.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.evidence is not null or new.evidence_seal is not null or new.signed_at is not null then
      raise exception 'Nová žádost musí být nepodepsaná.';
    end if;
    return new;
  end if;
  if new.doc_sha256 is distinct from old.doc_sha256 or new.evidence is distinct from old.evidence or new.evidence_seal is distinct from old.evidence_seal
     or new.signed_at is distinct from old.signed_at or new.user_id is distinct from old.user_id or new.case_id is distinct from old.case_id
     or new.level is distinct from old.level or new.identity_method is distinct from old.identity_method then
    raise exception 'Údaje podpisu nelze měnit.';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'pending' and new.status = 'cancelled') or (old.status = 'awaiting_check' and new.status in ('signed', 'declined'))) then
      raise exception 'Tuto změnu stavu nelze provést.';
    end if;
    if new.status = 'signed' and old.status = 'awaiting_check' then new.signed_at := now(); end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_signature_requests on public.signature_requests;
create trigger guard_signature_requests before insert or update or delete on public.signature_requests for each row execute function public.guard_signature_requests();

-- SMS kódy (jen server)
create table if not exists public.signature_otps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists signature_otps_req_idx on public.signature_otps (request_id, created_at desc);
alter table public.signature_otps enable row level security;

-- Průběh ověření totožnosti přes Bank iD (jen server). Výsledek se naváže na žádost o podpis nebo na identifikaci klienta.
create table if not exists public.identity_sessions (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  nonce text not null,
  code_verifier text not null,
  purpose text not null check (purpose in ('signature', 'aml')),
  ref_id uuid not null,
  link_token text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
alter table public.identity_sessions enable row level security;

-- Identifikace klienta (AML)
create table if not exists public.client_identifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  client_id uuid references public.lawyer_clients(id) on delete set null,
  method text not null default 'osobne' check (method in ('bankid', 'osobne', 'jine')),
  status text not null default 'draft' check (status in ('requested', 'verified_online', 'draft', 'confirmed')),
  full_name text not null default '' check (char_length(full_name) <= 200),
  birth_date date,
  address text not null default '' check (char_length(address) <= 400),
  nationality text not null default '' check (char_length(nationality) <= 80),
  doc_type text not null default '' check (char_length(doc_type) <= 60),
  doc_number text not null default '' check (char_length(doc_number) <= 60),
  doc_expires date,
  is_company boolean not null default false,
  company_ico text not null default '' check (char_length(company_ico) <= 20),
  beneficial_owner text not null default '' check (char_length(beneficial_owner) <= 1000),
  pep text not null default 'nevim' check (pep in ('ne', 'ano', 'nevim')),
  pep_note text not null default '' check (char_length(pep_note) <= 600),
  risk text not null default 'standardni' check (risk in ('nizke', 'standardni', 'vysoke')),
  purpose text not null default '' check (char_length(purpose) <= 800),
  funds_origin text not null default '' check (char_length(funds_origin) <= 800),
  online_result jsonb,
  identified_at date,
  next_review date,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists client_identifications_user_idx on public.client_identifications (user_id, created_at desc);
create index if not exists client_identifications_case_idx on public.client_identifications (case_id);
alter table public.client_identifications enable row level security;
drop policy if exists "client_identifications_own" on public.client_identifications;
create policy "client_identifications_own" on public.client_identifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Výsledek online ověření smí zapsat jen server; advokát jej nemůže podvrhnout
create or replace function public.guard_client_identifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.online_result is not null or new.method = 'bankid' and new.status <> 'requested' then raise exception 'Online výsledek zapisuje jen server.'; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.online_result is distinct from old.online_result then raise exception 'Online výsledek nelze měnit.'; end if;
  if tg_op = 'UPDATE' and new.method = 'bankid' and new.status in ('verified_online', 'confirmed') and new.online_result is null then raise exception 'Online ověření nebylo provedeno.'; end if;
  if tg_op = 'UPDATE' and old.method = 'bankid' and new.method <> 'bankid' and old.online_result is not null then raise exception 'Ověřený způsob nelze změnit.'; end if;
  return coalesce(new, old);
end; $$;
drop trigger if exists guard_client_identifications on public.client_identifications;
create trigger guard_client_identifications before insert or update on public.client_identifications for each row execute function public.guard_client_identifications();

do $$
declare t text;
begin
  foreach t in array array['signature_requests', 'client_identifications'] loop
    execute format('drop trigger if exists lock_when_expired on public.%I', t);
    execute format('create trigger lock_when_expired before insert or update or delete on public.%I for each row execute function public.block_when_locked()', t);
  end loop;
end $$;

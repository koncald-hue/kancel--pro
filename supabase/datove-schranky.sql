-- =====================================================================
-- DATOVÉ SCHRÁNKY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné zruseni-a-zamek.sql.
--
-- Přihlašovací údaje ke schránce (jméno a heslo) se ukládají JEN zašifrované šifrovacím heslem advokáta
-- (end-to-end, předpona e1:). Server ani provozovatel je přečíst nemůže. K ISDS se používají jen po odemčení
-- šifrovacího hesla v prohlížeči a server je po jednom volání zahodí. Samotné zprávy se do databáze neukládají;
-- do spisu se přenesou jen přílohy, které advokát výslovně uloží.
-- =====================================================================
create table if not exists public.isds_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  env text not null default 'prod' check (env in ('test', 'prod')),
  enc_cred text not null check (enc_cred like 'e1:%'),
  created_at timestamptz not null default now()
);
create index if not exists isds_accounts_user_idx on public.isds_accounts (user_id);
alter table public.isds_accounts enable row level security;
drop policy if exists "isds_accounts_select" on public.isds_accounts;
create policy "isds_accounts_select" on public.isds_accounts for select using (user_id = auth.uid());
drop policy if exists "isds_accounts_insert" on public.isds_accounts;
create policy "isds_accounts_insert" on public.isds_accounts for insert with check (user_id = auth.uid());
drop policy if exists "isds_accounts_delete" on public.isds_accounts;
create policy "isds_accounts_delete" on public.isds_accounts for delete using (user_id = auth.uid());

create or replace function public.limit_isds_accounts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.isds_accounts where user_id = new.user_id) >= 5 then raise exception 'Připojit lze nejvýše 5 datových schránek.'; end if;
  return new;
end; $$;
drop trigger if exists limit_isds_accounts on public.isds_accounts;
create trigger limit_isds_accounts before insert on public.isds_accounts for each row execute function public.limit_isds_accounts();

drop trigger if exists lock_when_expired on public.isds_accounts;
create trigger lock_when_expired before insert or update or delete on public.isds_accounts for each row execute function public.block_when_locked();

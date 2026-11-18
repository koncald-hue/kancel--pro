-- =====================================================================
-- 20261118_14  EVIDENCE ÚSCHOV A KLIENTSKÝCH PENĚZ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: lawyer.sql (lawyer_clients), cases.sql, 20261118_05 (mfa_ok), 20261117_01 (schema_migrations).
--
-- Jde o EVIDENCI (kniha pohybů), ne o účet. Kancelář peníze nedrží ani nepřijímá. Pohyby se jen přidávají:
-- opravit chybu lze jen opravným pohybem (storno), nikdy úpravou ani smazáním. Úschovu nelze uzavřít,
-- dokud zůstatek není nulový. Výdej nesmí překročit zůstatek. Vidí je jen vlastník záznamu (ne kolega ani vedoucí).
-- Před ostrým použitím nechte postup posoudit podle předpisů České advokátní komory.
-- =====================================================================

create table if not exists public.escrows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.lawyer_clients(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  purpose text not null default '' check (char_length(purpose) <= 1000),
  currency text not null default 'CZK' check (currency in ('CZK', 'EUR')),
  bank_account text not null default '' check (char_length(bank_account) <= 60),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_on date not null default current_date,
  closed_on date,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists escrows_user_idx on public.escrows (user_id, status);

create table if not exists public.escrow_moves (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'payout', 'correction_in', 'correction_out')),
  amount numeric(14, 2) not null check (amount > 0),
  moved_on date not null default current_date,
  party text not null default '' check (char_length(party) <= 200),
  reference text not null default '' check (char_length(reference) <= 120),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists escrow_moves_escrow_idx on public.escrow_moves (escrow_id, moved_on);

alter table public.escrows enable row level security;
alter table public.escrow_moves enable row level security;
drop policy if exists "escrows_own" on public.escrows;
create policy "escrows_own" on public.escrows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "escrow_moves_own" on public.escrow_moves;
create policy "escrow_moves_own" on public.escrow_moves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mfa_guard" on public.escrows;
create policy "mfa_guard" on public.escrows as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
drop policy if exists "mfa_guard" on public.escrow_moves;
create policy "mfa_guard" on public.escrow_moves as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Zůstatek úschovy z pohybů
create or replace function public.escrow_balance(p_escrow uuid) returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(case when kind in ('deposit', 'correction_in') then amount else -amount end), 0)
    from public.escrow_moves where escrow_id = p_escrow
$$;
revoke all on function public.escrow_balance(uuid) from public, anon;
grant execute on function public.escrow_balance(uuid) to authenticated;

-- Pohyby se nemění ani nemažou; výdej nesmí překročit zůstatek; do uzavřené úschovy se nezapisuje
create or replace function public.escrow_moves_guard() returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_status text; v_owner uuid; v_cur text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- správce databáze (service role) a kaskáda při smazání úschovy nebo celého účtu (GDPR) smí; běžný uživatel nikdy
    if coalesce(auth.role(), '') = 'service_role' and tg_op = 'DELETE' then return old; end if;
    if tg_op = 'DELETE' and (not exists (select 1 from public.escrows where id = old.escrow_id) or not exists (select 1 from auth.users where id = old.user_id)) then return old; end if;
    raise exception 'Pohyby úschovy nelze měnit ani mazat, použijte opravný pohyb.';
  end if;
  select status, user_id into v_status, v_owner from public.escrows where id = new.escrow_id;
  if v_status is null or v_owner <> new.user_id then raise exception 'Úschova neexistuje.'; end if;
  if v_status <> 'open' then raise exception 'Úschova je uzavřená.'; end if;
  if new.kind in ('payout', 'correction_out') and new.amount > public.escrow_balance(new.escrow_id) then
    raise exception 'Výdej převyšuje zůstatek úschovy.';
  end if;
  return new;
end; $$;
drop trigger if exists escrow_moves_guard_trg on public.escrow_moves;
create trigger escrow_moves_guard_trg before insert or update or delete on public.escrow_moves for each row execute function public.escrow_moves_guard();

-- Uzavřít úschovu jde jen s nulovým zůstatkem; uzavřená se znovu neotevírá a základní údaje se nemění
create or replace function public.escrows_guard() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op = 'UPDATE' then
    -- u uzavřené úschovy smí databáze jen odpojit smazaného klienta nebo věc (on delete set null)
    if old.status = 'closed' then
      if (to_jsonb(new) - 'client_id' - 'case_id') = (to_jsonb(old) - 'client_id' - 'case_id') then return new; end if;
      raise exception 'Uzavřenou úschovu nelze měnit.';
    end if;
    if new.status = 'closed' and public.escrow_balance(old.id) <> 0 then raise exception 'Úschovu lze uzavřít jen s nulovým zůstatkem.'; end if;
    if new.currency <> old.currency or new.user_id <> old.user_id then raise exception 'Měnu ani vlastníka úschovy nelze měnit.'; end if;
    if new.status = 'closed' and new.closed_on is null then new.closed_on := current_date; end if;
  elsif tg_op = 'DELETE' then
    if coalesce(auth.role(), '') = 'service_role' or not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
    if exists (select 1 from public.escrow_moves where escrow_id = old.id) then raise exception 'Úschovu s pohyby nelze smazat.'; end if;
    return old;
  end if;
  return new;
end; $$;
drop trigger if exists escrows_guard_trg on public.escrows;
create trigger escrows_guard_trg before update or delete on public.escrows for each row execute function public.escrows_guard();

insert into public.schema_migrations (name) values ('20261118_14_evidence-uschov') on conflict do nothing;

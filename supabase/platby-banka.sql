-- =====================================================================
-- BANKOVNÍ ÚČET, PÁROVÁNÍ PLATEB A UPOMÍNKY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné fakturace.sql, platby.sql a zruseni-a-zamek.sql.
--
-- bank_accounts: připojené účty. Token k Fio API je uložený JEN zašifrovaný šifrovacím heslem advokáta (e1:), server ho nezná.
-- bank_transactions: stažené pohyby; každý příchozí je nový, spárovaný (s platbou u vyúčtování) nebo ignorovaný.
-- Zdroj pravdy o zaplacení zůstává invoice_payments. Smaže-li se platba, spárovaný pohyb se sám vrátí mezi nespárované.
-- invoice_reminders: evidence odeslaných upomínek.
-- =====================================================================
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  provider text not null default 'csv' check (provider in ('fio', 'csv')),
  iban text not null default '',
  enc_token text check (enc_token is null or enc_token like 'e1:%'),
  auto_match boolean not null default true,
  last_sync_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now()
);
alter table public.bank_accounts enable row level security;
drop policy if exists "bank_accounts_own" on public.bank_accounts;
create policy "bank_accounts_own" on public.bank_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  txid text not null check (char_length(txid) <= 120),
  tx_date date not null,
  amount numeric(14, 2) not null check (amount <> 0),
  currency text not null default 'CZK',
  vs text not null default '',
  ks text not null default '',
  ss text not null default '',
  counterparty text not null default '' check (char_length(counterparty) <= 300),
  account_no text not null default '',
  bank_code text not null default '',
  message text not null default '' check (char_length(message) <= 600),
  tx_type text not null default '',
  status text not null default 'new' check (status in ('new', 'matched', 'ignored')),
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_id uuid references public.invoice_payments(id) on delete set null,
  matched_by text not null default '' check (matched_by in ('', 'vs', 'navrh', 'rucne')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (account_id, txid)
);
create index if not exists bank_tx_user_idx on public.bank_transactions (user_id, tx_date desc);
create index if not exists bank_tx_status_idx on public.bank_transactions (user_id, status);
alter table public.bank_transactions enable row level security;
drop policy if exists "bank_tx_own" on public.bank_transactions;
create policy "bank_tx_own" on public.bank_transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Smazání platby u vyúčtování uvolní spárovaný bankovní pohyb
create or replace function public.release_bank_tx()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.bank_transactions set status = 'new', invoice_id = null, payment_id = null, matched_by = '' where payment_id = old.id;
  return old;
end; $$;
drop trigger if exists invoice_payments_release_tx on public.invoice_payments;
create trigger invoice_payments_release_tx before delete on public.invoice_payments for each row execute function public.release_bank_tx();

create table if not exists public.invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  level integer not null check (level between 1 and 3),
  sent_on date not null default current_date,
  channel text not null default '' check (char_length(channel) <= 40),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists invoice_reminders_invoice_idx on public.invoice_reminders (invoice_id, sent_on desc);
alter table public.invoice_reminders enable row level security;
drop policy if exists "invoice_reminders_own" on public.invoice_reminders;
create policy "invoice_reminders_own" on public.invoice_reminders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['bank_accounts', 'bank_transactions', 'invoice_reminders'] loop
    execute format('drop trigger if exists lock_when_expired on public.%I', t);
    execute format('create trigger lock_when_expired before insert or update or delete on public.%I for each row execute function public.block_when_locked()', t);
  end loop;
end $$;

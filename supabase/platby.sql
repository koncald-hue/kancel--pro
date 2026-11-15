-- =====================================================================
-- PLATBY K VYÚČTOVÁNÍM (částečné platby, přehled po klientech)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné fakturace.sql.
-- =====================================================================

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount <> 0),
  paid_on date not null default current_date,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id, paid_on);

alter table public.invoice_payments enable row level security;
drop policy if exists "invoice_payments_own" on public.invoice_payments;
create policy "invoice_payments_own" on public.invoice_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.invoice_payments to authenticated;

-- Platbu lze zapsat jen k vystavenému (nebo už zaplacenému) vyúčtování
create or replace function public.invoice_payments_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if tg_op <> 'DELETE' and coalesce(v_status, '') not in ('issued', 'paid') then raise exception 'Platbu lze zapsat jen k vystavenému vyúčtování.'; end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists invoice_payments_guard_trg on public.invoice_payments;
create trigger invoice_payments_guard_trg before insert or update or delete on public.invoice_payments for each row execute function public.invoice_payments_guard();

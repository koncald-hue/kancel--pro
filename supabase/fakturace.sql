-- =====================================================================
-- KLIENTI VE VĚCECH, CENÍK A VYÚČTOVÁNÍ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné lawyer.sql, cases.sql a case-meta.sql.
--
--   1. Klient zadaný ve věci se sám objeví v seznamu klientů (a doplní se mu e-mail a telefon).
--   2. Ceník produktů a služeb každého advokáta.
--   3. Vyúčtování (faktury) s položkami z ceníku a z výkazů práce. Po vystavení je nelze měnit.
-- Každý uživatel vidí jen své záznamy.
-- =====================================================================

-- ---------- 1. Klienti ----------
alter table public.lawyer_clients add column if not exists address text not null default '';
alter table public.lawyer_clients add column if not exists ico text not null default '';
alter table public.lawyer_clients add column if not exists dic text not null default '';

alter table public.cases add column if not exists client_id uuid references public.lawyer_clients(id) on delete set null;
alter table public.cases add column if not exists client_email text not null default '';
alter table public.cases add column if not exists client_phone text not null default '';
create index if not exists cases_client_idx on public.cases (client_id);

-- Klient zadaný ve věci se najde (podle jména bez ohledu na velikost písmen) nebo založí a věc se k němu připojí
create or replace function public.sync_case_client()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_name text := btrim(coalesce(new.client_name, '')); v_email text := btrim(coalesce(new.client_email, '')); v_phone text := btrim(coalesce(new.client_phone, '')); v_id uuid;
begin
  if v_name = '' then new.client_id := null; return new; end if;
  select id into v_id from public.lawyer_clients where user_id = new.user_id and lower(name) = lower(v_name) limit 1;
  if v_id is null then
    insert into public.lawyer_clients (user_id, name, email, phone) values (new.user_id, v_name, v_email, v_phone) returning id into v_id;
  else
    update public.lawyer_clients set
      email = case when v_email <> '' then v_email else email end,
      phone = case when v_phone <> '' then v_phone else phone end
    where id = v_id;
  end if;
  new.client_id := v_id;
  return new;
end;
$$;
drop trigger if exists cases_sync_client on public.cases;
create trigger cases_sync_client before insert or update of client_name, client_email, client_phone on public.cases for each row execute function public.sync_case_client();

-- Doplnění klientů ke stávajícím věcem
update public.cases set client_name = client_name where btrim(client_name) <> '' and client_id is null;

-- ---------- 2. Fakturační údaje advokáta ----------
alter table public.lawyer_access add column if not exists ico text not null default '';
alter table public.lawyer_access add column if not exists dic text not null default '';
alter table public.lawyer_access add column if not exists vat_payer boolean not null default false;
alter table public.lawyer_access add column if not exists bank_account text not null default '';
alter table public.lawyer_access add column if not exists due_days integer not null default 14 check (due_days between 1 and 365);
alter table public.lawyer_access add column if not exists invoice_note text not null default '';

create or replace function public.save_billing_settings(p_ico text, p_dic text, p_vat boolean, p_bank text, p_due_days integer, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lawyer_access set
    ico = left(btrim(coalesce(p_ico, '')), 20), dic = left(btrim(coalesce(p_dic, '')), 20), vat_payer = coalesce(p_vat, false),
    bank_account = left(btrim(coalesce(p_bank, '')), 60), due_days = greatest(1, least(365, coalesce(p_due_days, 14))),
    invoice_note = left(btrim(coalesce(p_note, '')), 500)
  where user_id = auth.uid();
  if not found then raise exception 'Nejdřív zahajte zkušební přístup.'; end if;
end;
$$;
revoke all on function public.save_billing_settings(text, text, boolean, text, integer, text) from public;
grant execute on function public.save_billing_settings(text, text, boolean, text, integer, text) to authenticated;

-- ---------- 3. Ceník ----------
create table if not exists public.price_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  kind text not null default 'sluzba' check (kind in ('sluzba', 'produkt', 'vydaj')),
  unit text not null default 'ks' check (char_length(unit) between 1 and 20),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  vat_rate numeric(5, 2) not null default 21 check (vat_rate between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists price_items_user_idx on public.price_items (user_id, active, name);

-- ---------- 4. Vyúčtování ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.lawyer_clients(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  number text,
  title text not null default '',
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'cancelled')),
  paid_at timestamptz,
  note text not null default '',
  currency text not null default 'CZK' check (currency in ('CZK', 'EUR')),
  supplier_snapshot jsonb not null default '{}'::jsonb,
  client_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists invoices_number_idx on public.invoices (user_id, number) where number is not null;
create index if not exists invoices_user_idx on public.invoices (user_id, created_at desc);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  description text not null check (char_length(description) between 1 and 500),
  qty numeric(12, 3) not null check (qty <> 0),
  unit text not null default 'ks',
  unit_price numeric(12, 2) not null,
  vat_rate numeric(5, 2) not null default 21 check (vat_rate between 0 and 100),
  price_item_id uuid references public.price_items(id) on delete set null,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);

alter table public.price_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
drop policy if exists "price_items_own" on public.price_items;
create policy "price_items_own" on public.price_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "invoices_own" on public.invoices;
create policy "invoices_own" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "invoice_lines_own" on public.invoice_lines;
create policy "invoice_lines_own" on public.invoice_lines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.price_items, public.invoices, public.invoice_lines to authenticated;

-- Ochrana: vystavené vyúčtování nejde měnit (jen označit jako zaplacené nebo stornované, upravit poznámku).
-- Z konceptu ho smí vystavit jen funkce issue_invoice (přidělí číslo a uloží údaje dodavatele a klienta).
create or replace function public.invoices_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Vystavené vyúčtování nelze smazat, můžete ho stornovat.'; end if;
    return old;
  end if;
  if old.status = 'draft' then
    if new.status <> 'draft' and coalesce(current_setting('app.issuing', true), '') <> '1' then raise exception 'Vyúčtování se vystavuje tlačítkem Vystavit.'; end if;
    return new;
  end if;
  if new.number is distinct from old.number or new.client_id is distinct from old.client_id or new.case_id is distinct from old.case_id
     or new.issue_date is distinct from old.issue_date or new.due_date is distinct from old.due_date or new.title is distinct from old.title
     or new.currency is distinct from old.currency or new.supplier_snapshot is distinct from old.supplier_snapshot or new.client_snapshot is distinct from old.client_snapshot
     or new.user_id is distinct from old.user_id then
    raise exception 'Vystavené vyúčtování nelze upravovat.';
  end if;
  if new.status = 'draft' then raise exception 'Vystavené vyúčtování nelze vrátit do konceptu.'; end if;
  return new;
end;
$$;
drop trigger if exists invoices_guard_trg on public.invoices;
create trigger invoices_guard_trg before update or delete on public.invoices for each row execute function public.invoices_guard();

create or replace function public.invoice_lines_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status is not null and v_status <> 'draft' then raise exception 'Položky vystaveného vyúčtování nelze měnit.'; end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists invoice_lines_guard_trg on public.invoice_lines;
create trigger invoice_lines_guard_trg before insert or update or delete on public.invoice_lines for each row execute function public.invoice_lines_guard();

-- Vystavení: přidělí číslo RRRR-NNN, uloží údaje dodavatele a klienta ke dni vystavení a označí použité výkazy jako vyfakturované
create or replace function public.issue_invoice(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare inv public.invoices; la public.lawyer_access; cl public.lawyer_clients; v_year text; v_seq integer; v_num text; v_client jsonb;
begin
  select * into inv from public.invoices where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Vyúčtování nenalezeno.'; end if;
  if inv.status <> 'draft' then raise exception 'Vyúčtování už je vystavené.'; end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then raise exception 'Vyúčtování nemá žádné položky.'; end if;
  select * into la from public.lawyer_access where user_id = auth.uid();
  if not found then raise exception 'Nejdřív zahajte zkušební přístup.'; end if;
  v_client := inv.client_snapshot;
  if inv.client_id is not null then
    select * into cl from public.lawyer_clients where id = inv.client_id and user_id = auth.uid();
    if found then v_client := jsonb_build_object('name', cl.name, 'address', cl.address, 'ico', cl.ico, 'dic', cl.dic, 'email', cl.email, 'phone', cl.phone); end if;
  end if;
  if coalesce(v_client ->> 'name', '') = '' then raise exception 'Vyberte klienta nebo vyplňte odběratele.'; end if;
  v_year := to_char(inv.issue_date, 'YYYY');
  select coalesce(max(((regexp_match(number, '^[0-9]{4}-([0-9]+)$'))[1])::integer), 0) + 1 into v_seq from public.invoices where user_id = auth.uid() and number like v_year || '-%';
  v_num := v_year || '-' || lpad(v_seq::text, 3, '0');
  perform set_config('app.issuing', '1', true);
  update public.invoices set
    status = 'issued', number = v_num, due_date = coalesce(due_date, issue_date + la.due_days),
    client_snapshot = v_client,
    supplier_snapshot = jsonb_build_object('name', coalesce(nullif(la.display_name, ''), la.email), 'firm', la.firm_name, 'address', la.office, 'ico', la.ico, 'dic', la.dic, 'vat_payer', la.vat_payer, 'bank_account', la.bank_account, 'email', coalesce(nullif(la.contact_email, ''), la.email), 'phone', la.phone, 'web', la.website, 'note', la.invoice_note, 'bar_number', la.bar_number)
  where id = inv.id;
  update public.time_entries set billed = true where user_id = auth.uid() and id in (select time_entry_id from public.invoice_lines where invoice_id = inv.id and time_entry_id is not null);
  return v_num;
end;
$$;
revoke all on function public.issue_invoice(uuid) from public;
grant execute on function public.issue_invoice(uuid) to authenticated;

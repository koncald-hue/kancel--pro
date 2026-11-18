-- =====================================================================
-- 20261118_20  ÚČETNICTVÍ PROVOZOVATELE A SPRÁVA (jen pro tým provozovatele, is_staff)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: 00-zaklad.sql (is_staff), verification-billing.sql (lawyer_orders), insolvence.sql (isir_orders),
-- lawyer.sql (lawyer_access), 20261117_01 (schema_migrations).
--
-- 1) Údaje provozovatele pro doklady (dodavatel, plátce DPH, sazba, řada čísel).
-- 2) Automatická faktura: jakmile se objednávka (předplatné, balíček kanceláře, hlídání insolvence) označí jako zaplacená,
--    databáze vystaví fakturu s dalším číslem řady a snímkem odběratele. Stejná objednávka dostane fakturu jen jednou.
-- 3) Výdaje provozovatele (ruční zápis), poznámky správce k uživatelům a záznam úkonů správce.
-- Částka objednávky (price_czk) je konečná cena pro zákazníka; u plátce DPH se z ní DPH vypočítá „shora“.
-- Faktury se nemažou; oprava je dobropis (záporná faktura s odkazem na původní).
-- =====================================================================

create table if not exists public.ops_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default '',
  address text not null default '',
  ico text not null default '',
  dic text not null default '',
  vat_payer boolean not null default false,
  vat_rate numeric(5, 2) not null default 21 check (vat_rate in (0, 12, 21)),
  bank_account text not null default '',
  email text not null default '',
  register_note text not null default '' check (char_length(register_note) <= 300),
  prefix text not null default '' check (prefix ~ '^[A-Z]{0,4}$'),
  due_days integer not null default 14 check (due_days between 0 and 90),
  updated_at timestamptz not null default now()
);
insert into public.ops_settings (id) values (1) on conflict do nothing;

create table if not exists public.ops_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  year integer not null,
  seq integer not null,
  source text not null check (source in ('predplatne', 'insolvence', 'eshop', 'rucne', 'dobropis')),
  source_ref text,
  user_id uuid references auth.users(id) on delete set null,
  issue_date date not null,
  paid_on date,
  description text not null check (char_length(description) between 1 and 300),
  total numeric(12, 2) not null,
  base numeric(12, 2) not null,
  vat numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  buyer jsonb not null default '{}'::jsonb,
  supplier jsonb not null default '{}'::jsonb,
  credit_for uuid references public.ops_invoices(id),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (year, seq)
);
create unique index if not exists ops_invoices_source_idx on public.ops_invoices (source, source_ref) where source_ref is not null;

create table if not exists public.ops_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  supplier text not null default '' check (char_length(supplier) <= 200),
  description text not null check (char_length(description) between 1 and 300),
  category text not null default 'ostatni' check (category in ('hosting', 'software', 'marketing', 'pravni', 'ucetni', 'bankovni', 'ostatni')),
  total numeric(12, 2) not null check (total > 0),
  vat numeric(12, 2) not null default 0 check (vat >= 0),
  doc_no text not null default '' check (char_length(doc_no) <= 60),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_log (
  id bigint generated always as identity primary key,
  staff_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target text not null default '' check (char_length(target) <= 300),
  detail text not null default '' check (char_length(detail) <= 1000),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['ops_settings', 'ops_invoices', 'ops_expenses', 'ops_notes', 'ops_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff_select" on public.%I', t);
    execute format('create policy "staff_select" on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
end $$;
-- Zápisy: nastavení, výdaje a poznámky smí tým měnit; faktury vznikají jen funkcemi; záznam úkonů se jen přidává
drop policy if exists "staff_write" on public.ops_settings;
create policy "staff_write" on public.ops_settings for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_write" on public.ops_expenses;
create policy "staff_write" on public.ops_expenses for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_write" on public.ops_notes;
create policy "staff_write" on public.ops_notes for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_insert" on public.ops_log;
create policy "staff_insert" on public.ops_log for insert to authenticated with check (public.is_staff() and staff_id = auth.uid());

-- Vystavení faktury (vnitřní funkce): další číslo řady, výpočet DPH „shora“ a snímky dodavatele i odběratele
create or replace function public.ops_issue(p_source text, p_ref text, p_user uuid, p_total numeric, p_desc text, p_paid timestamptz, p_buyer jsonb, p_credit_for uuid default null, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.ops_settings; v_year integer; v_seq integer; v_id uuid; v_rate numeric; v_base numeric; v_vat numeric; v_date date;
begin
  if p_ref is not null and exists (select 1 from public.ops_invoices where source = p_source and source_ref = p_ref) then return null; end if;
  select * into s from public.ops_settings where id = 1;
  v_date := coalesce(p_paid::date, current_date);
  v_year := extract(year from v_date)::integer;
  perform pg_advisory_xact_lock(hashtext('ops_invoice:' || v_year::text));
  select coalesce(max(seq), 0) + 1 into v_seq from public.ops_invoices where year = v_year;
  v_rate := case when coalesce(s.vat_payer, false) then s.vat_rate else 0 end;
  v_base := round(p_total / (1 + v_rate / 100), 2);
  v_vat := round(p_total - v_base, 2);
  insert into public.ops_invoices (number, year, seq, source, source_ref, user_id, issue_date, paid_on, description, total, base, vat, vat_rate, buyer, supplier, credit_for, note)
  values (coalesce(s.prefix, '') || v_year::text || lpad(v_seq::text, 4, '0'), v_year, v_seq, p_source, p_ref, p_user, v_date, p_paid::date, left(p_desc, 300), p_total, v_base, v_vat, v_rate,
          coalesce(p_buyer, '{}'::jsonb),
          jsonb_build_object('name', s.name, 'address', s.address, 'ico', s.ico, 'dic', s.dic, 'vat_payer', s.vat_payer, 'bank_account', s.bank_account, 'email', s.email, 'register_note', s.register_note),
          p_credit_for, left(coalesce(p_note, ''), 500))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.ops_issue(text, text, uuid, numeric, text, timestamptz, jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.ops_buyer(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('name', coalesce(nullif(la.firm_name, ''), nullif(la.display_name, ''), la.email), 'address', la.office, 'ico', la.ico, 'dic', la.dic, 'email', la.email)
                     from public.lawyer_access la where la.user_id = p_user), '{}'::jsonb)
$$;
revoke all on function public.ops_buyer(uuid) from public, anon, authenticated;

-- Automaticky při zaplacení objednávky
create or replace function public.ops_on_lawyer_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.ops_issue('predplatne', new.id::text, new.user_id, new.price_czk,
      'Předplatné aplikace Kancelář (' || case new.plan when 'month' then '1 měsíc' when 'half' then '6 měsíců' else '12 měsíců' end ||
        case when coalesce(to_jsonb(new) ->> 'seats', '') <> '' then ', ' || (to_jsonb(new) ->> 'seats') || ' míst' else '' end ||
        case when new.period_start is not null then ', ' || to_char(new.period_start, 'DD.MM.YYYY') || '–' || to_char(new.period_end, 'DD.MM.YYYY') else '' end || ')',
      coalesce(new.paid_at, now()), public.ops_buyer(new.user_id));
  end if;
  return new;
end; $$;
drop trigger if exists ops_lawyer_order_trg on public.lawyer_orders;
create trigger ops_lawyer_order_trg after insert or update of status on public.lawyer_orders for each row execute function public.ops_on_lawyer_order();

create or replace function public.ops_on_isir_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.ops_issue('insolvence', new.id::text, new.user_id, new.price_czk,
      'Hlídání insolvenčního rejstříku (' || case new.plan when 'month' then '1 měsíc' when 'half' then '6 měsíců' else '12 měsíců' end ||
        case when new.period_end is not null then ', do ' || to_char(new.period_end, 'DD.MM.YYYY') else '' end || ')',
      coalesce(new.paid_at, now()), public.ops_buyer(new.user_id));
  end if;
  return new;
end; $$;
drop trigger if exists ops_isir_order_trg on public.isir_orders;
create trigger ops_isir_order_trg after insert or update of status on public.isir_orders for each row execute function public.ops_on_isir_order();

-- Ruční faktura a dobropis (jen tým)
create or replace function public.ops_manual_invoice(p_desc text, p_total numeric, p_paid date, p_buyer jsonb, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_staff() then raise exception 'Jen pro tým provozovatele.'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Částka musí být kladná.'; end if;
  if coalesce(p_buyer ->> 'name', '') = '' then raise exception 'Vyplňte odběratele.'; end if;
  v := public.ops_issue('rucne', null, null, p_total, p_desc, coalesce(p_paid, current_date)::timestamptz, p_buyer, null, p_note);
  insert into public.ops_log (staff_id, action, target, detail) values (auth.uid(), 'ruční faktura', (select number from public.ops_invoices where id = v), left(p_desc, 300));
  return v;
end; $$;
revoke all on function public.ops_manual_invoice(text, numeric, date, jsonb, text) from public, anon;
grant execute on function public.ops_manual_invoice(text, numeric, date, jsonb, text) to authenticated;

create or replace function public.ops_credit_note(p_invoice uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.ops_invoices; v uuid;
begin
  if not public.is_staff() then raise exception 'Jen pro tým provozovatele.'; end if;
  select * into i from public.ops_invoices where id = p_invoice;
  if not found or i.total <= 0 then raise exception 'Fakturu nelze dobropisovat.'; end if;
  if exists (select 1 from public.ops_invoices where credit_for = i.id) then raise exception 'K faktuře už dobropis existuje.'; end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'Uveďte důvod dobropisu.'; end if;
  v := public.ops_issue('dobropis', null, i.user_id, -i.total, 'Dobropis k faktuře ' || i.number, now(), i.buyer, i.id, p_reason);
  insert into public.ops_log (staff_id, action, target, detail) values (auth.uid(), 'dobropis', i.number, left(p_reason, 300));
  return v;
end; $$;
revoke all on function public.ops_credit_note(uuid, text) from public, anon;
grant execute on function public.ops_credit_note(uuid, text) to authenticated;

-- Doplnění faktur k objednávkám zaplaceným před zapnutím účetnictví (jednorázově, jen tým)
create or replace function public.ops_backfill() returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v uuid;
begin
  if not public.is_staff() then raise exception 'Jen pro tým provozovatele.'; end if;
  for r in select * from public.lawyer_orders where status = 'paid' order by coalesce(paid_at, created_at) loop
    v := public.ops_issue('predplatne', r.id::text, r.user_id, r.price_czk, 'Předplatné aplikace Kancelář (' || case r.plan when 'month' then '1 měsíc' when 'half' then '6 měsíců' else '12 měsíců' end || ')', coalesce(r.paid_at, r.created_at), public.ops_buyer(r.user_id));
    if v is not null then n := n + 1; end if;
  end loop;
  for r in select * from public.isir_orders where status = 'paid' order by coalesce(paid_at, created_at) loop
    v := public.ops_issue('insolvence', r.id::text, r.user_id, r.price_czk, 'Hlídání insolvenčního rejstříku', coalesce(r.paid_at, r.created_at), public.ops_buyer(r.user_id));
    if v is not null then n := n + 1; end if;
  end loop;
  insert into public.ops_log (staff_id, action, detail) values (auth.uid(), 'doplnění faktur', n::text);
  return n;
end; $$;
revoke all on function public.ops_backfill() from public, anon;
grant execute on function public.ops_backfill() to authenticated;

insert into public.schema_migrations (name) values ('20261118_20_ucetnictvi-provozovatele') on conflict do nothing;

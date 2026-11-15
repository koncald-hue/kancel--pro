-- =====================================================================
-- PŮLROČNÍ PLÁN: přidá k měsíčnímu a ročnímu tarifu i půlroční.
-- Spusť JEDNOU v Supabase (SQL Editor -> New query -> vložit -> Run). Jde spustit i opakovaně.
-- Ceny pak nastavíš ve Správě (/admin/advokati).
-- =====================================================================

alter table public.lawyer_orders drop constraint if exists lawyer_orders_plan_check;
alter table public.lawyer_orders add constraint lawyer_orders_plan_check check (plan in ('month', 'half', 'year'));

create or replace function public.lawyer_prices()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('month', public.app_setting('lawyer_price_month', 0), 'half', public.app_setting('lawyer_price_half', 0), 'year', public.app_setting('lawyer_price_year', 0));
$$;

create or replace function public.create_lawyer_order(p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_price integer; v_id uuid;
begin
  if p_plan not in ('month', 'half', 'year') then raise exception 'Neplatný tarif.'; end if;
  if not exists (select 1 from public.lawyer_access where user_id = auth.uid() and verification_status = 'verified') then
    raise exception 'Předplatné lze koupit až po ověření totožnosti.';
  end if;
  v_price := public.app_setting(case p_plan when 'month' then 'lawyer_price_month' when 'half' then 'lawyer_price_half' else 'lawyer_price_year' end, 0);
  if v_price <= 0 then raise exception 'Cena zatím není nastavena.'; end if;
  update public.lawyer_orders set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  insert into public.lawyer_orders (user_id, plan, price_czk) values (auth.uid(), p_plan, v_price) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.apply_lawyer_payment(p_order uuid, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare o public.lawyer_orders; la public.lawyer_access; v_start date; v_end date;
begin
  select * into o from public.lawyer_orders where id = p_order for update;
  if not found then return 'notfound'; end if;
  if o.status in ('paid', 'refund_due') then return 'already'; end if;
  select * into la from public.lawyer_access where user_id = o.user_id;
  if not found or la.verification_status <> 'verified' then
    update public.lawyer_orders set status = 'refund_due', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now() where id = o.id;
    return 'refund_due';
  end if;
  v_start := case when la.status = 'active' and la.until is not null and la.until > current_date then la.until else current_date end;
  v_end := (v_start + case o.plan when 'year' then interval '1 year' when 'half' then interval '6 months' else interval '1 month' end)::date;
  update public.lawyer_orders set status = 'paid', provider_ref = left(coalesce(p_ref, ''), 120), paid_at = now(), period_start = v_start, period_end = v_end where id = o.id;
  update public.lawyer_access set status = 'active', until = v_end where user_id = o.user_id;
  return 'ok';
end;
$$;

revoke all on function public.lawyer_prices() from public;
grant execute on function public.lawyer_prices() to authenticated;
revoke all on function public.create_lawyer_order(text) from public;
grant execute on function public.create_lawyer_order(text) to authenticated;
revoke all on function public.apply_lawyer_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_lawyer_payment(uuid, text) to service_role;

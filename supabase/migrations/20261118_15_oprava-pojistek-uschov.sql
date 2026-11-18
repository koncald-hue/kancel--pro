-- =====================================================================
-- 20261118_15  OPRAVA POJISTEK ÚSCHOV (spouštět po 20261118_14)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Pojistky četly auth.users jako přihlášený uživatel, na to nemá právo, takže mazání úschovy bez pohybů padalo
-- na „permission denied“. Funkce teď běží jako security definer (s pevným search_path).
-- =====================================================================

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

insert into public.schema_migrations (name) values ('20261118_15_oprava-pojistek-uschov') on conflict do nothing;

-- (1) Úplné smazání účtu advokáta ve Správě (jen tým). Smaže přihlášení i všechna data účtu. Nevratné.
--     Účet se zaplacenými objednávkami se smaže jen s výslovným p_force (účetní záznamy zůstávají v účetní knize).
-- (2) Zákaz registrace i změny e-mailu na adresu „Skrýt můj e-mail“ od Applu (privaterelay.appleid.com).
create or replace function public.admin_delete_user(p_user_id uuid, p_force boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if not public.is_staff() then raise exception 'Jen pro tým.'; end if;
  if p_user_id = auth.uid() then raise exception 'Sám sebe smazat nejde.'; end if;
  select email into v_email from auth.users where id = p_user_id;
  if not found then raise exception 'Uživatel neexistuje.'; end if;
  if exists (select 1 from public.staff where user_id = p_user_id) then raise exception 'Člena týmu smazat nejde.'; end if;
  if not p_force and exists (select 1 from public.lawyer_orders where user_id = p_user_id and status in ('paid', 'refund_due')) then
    raise exception 'Účet má zaplacené objednávky.';
  end if;
  insert into public.ops_log (staff_id, action, target, detail)
  values (auth.uid(), 'smazání účtu', coalesce(v_email, ''), case when p_force then 'včetně zaplacených objednávek' else '' end);
  delete from auth.users where id = p_user_id;
end;
$$;
revoke all on function public.admin_delete_user(uuid, boolean) from public;
grant execute on function public.admin_delete_user(uuid, boolean) to authenticated;

create or replace function public.block_relay_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) like '%@privaterelay.appleid.com' or lower(coalesce(new.email, '')) like '%.privaterelay.appleid.com' then
    raise exception 'Adresy ze služby Skrýt můj e-mail od Applu nepřijímáme. Zadejte svůj skutečný e-mail.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_relay_email_ins on auth.users;
create trigger block_relay_email_ins before insert on auth.users
  for each row execute function public.block_relay_email();

drop trigger if exists block_relay_email_upd on auth.users;
create trigger block_relay_email_upd before update of email on auth.users
  for each row when (new.email is distinct from old.email) execute function public.block_relay_email();

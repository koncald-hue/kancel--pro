-- =====================================================================
-- ŠIFROVANÉ SDÍLENÍ DOKUMENTŮ MEZI ČLENY KANCELÁŘE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql a verification-e2ee.sql.
--
-- Každý člen má pár klíčů (RSA): veřejný klíč je uložený veřejně v rámci kanceláře, soukromý klíč je uložený
-- jen zašifrovaný hlavním klíčem člena (ten zná jen on). Soubor se zašifruje v prohlížeči odesílatele náhodným
-- klíčem a ten se zabalí veřejným klíčem příjemce (a odesílatele). Server a databáze vidí jen zašifrovaná data.
-- =====================================================================

-- Jsou dva uživatelé členy téže kanceláře?
create or replace function public.same_firm(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.firm_members x join public.firm_members y on x.firm_id = y.firm_id where x.user_id = a and y.user_id = b);
$$;
revoke all on function public.same_firm(uuid, uuid) from public;
grant execute on function public.same_firm(uuid, uuid) to authenticated;

create table if not exists public.member_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key text not null check (char_length(public_key) < 4000),
  wrapped_private text not null check (char_length(wrapped_private) < 8000),
  created_at timestamptz not null default now()
);
alter table public.member_keys enable row level security;
drop policy if exists "member_keys_read" on public.member_keys;
create policy "member_keys_read" on public.member_keys for select using (user_id = auth.uid() or public.same_firm(auth.uid(), user_id));
drop policy if exists "member_keys_insert" on public.member_keys;
create policy "member_keys_insert" on public.member_keys for insert with check (user_id = auth.uid());
drop policy if exists "member_keys_update" on public.member_keys;
create policy "member_keys_update" on public.member_keys for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.member_keys to authenticated;

create table if not exists public.firm_shares (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  size bigint not null check (size >= 0 and size <= 52428800),
  enc_name text not null,
  enc_note text not null default '',
  wrapped_key_recipient text not null,
  wrapped_key_sender text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists firm_shares_recipient_idx on public.firm_shares (recipient_id, created_at desc);
create index if not exists firm_shares_sender_idx on public.firm_shares (sender_id, created_at desc);

alter table public.firm_shares enable row level security;
drop policy if exists "firm_shares_read" on public.firm_shares;
create policy "firm_shares_read" on public.firm_shares for select using (auth.uid() in (sender_id, recipient_id));
-- Odeslat lze jen kolegovi ze stejné kanceláře a jen jako sám sebe
drop policy if exists "firm_shares_insert" on public.firm_shares;
create policy "firm_shares_insert" on public.firm_shares for insert with check (
  sender_id = auth.uid() and recipient_id <> auth.uid() and public.same_firm(sender_id, recipient_id)
  and exists (select 1 from public.firm_members m where m.user_id = auth.uid() and m.firm_id = firm_shares.firm_id)
);
drop policy if exists "firm_shares_delete" on public.firm_shares;
create policy "firm_shares_delete" on public.firm_shares for delete using (auth.uid() in (sender_id, recipient_id));
grant select, insert, delete on public.firm_shares to authenticated;

-- Označení za přečtené smí jen příjemce
create or replace function public.mark_share_read(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.firm_shares set read_at = coalesce(read_at, now()) where id = p_id and recipient_id = auth.uid();
$$;
revoke all on function public.mark_share_read(uuid) from public;
grant execute on function public.mark_share_read(uuid) to authenticated;

-- Kolegové v kanceláři (jméno, e-mail a zda mají zapnuté sdílení). Obsah jejich věcí nikdo nevidí.
create or replace function public.firm_colleagues()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.firm_members where user_id = auth.uid();
  if v_firm is null then return null; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'name', coalesce(nullif(la.display_name, ''), la.email, ''),
      'email', coalesce(nullif(la.contact_email, ''), la.email, ''),
      'has_keys', exists (select 1 from public.member_keys k where k.user_id = m.user_id)
    ) order by coalesce(nullif(la.display_name, ''), la.email)), '[]'::jsonb)
    from public.firm_members m left join public.lawyer_access la on la.user_id = m.user_id
    where m.firm_id = v_firm and m.user_id <> auth.uid()
  );
end;
$$;
revoke all on function public.firm_colleagues() from public;
grant execute on function public.firm_colleagues() to authenticated;

-- Úložiště zašifrovaných souborů (soukromé)
insert into storage.buckets (id, name, public) values ('firm-shares', 'firm-shares', false) on conflict (id) do nothing;

drop policy if exists "firm-shares: odesilatel nahrava" on storage.objects;
create policy "firm-shares: odesilatel nahrava" on storage.objects for insert to authenticated
  with check (bucket_id = 'firm-shares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "firm-shares: ucastnici cetou" on storage.objects;
create policy "firm-shares: ucastnici cetou" on storage.objects for select to authenticated
  using (bucket_id = 'firm-shares' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.firm_shares s where s.path = name and s.recipient_id = auth.uid())
  ));
drop policy if exists "firm-shares: ucastnici mazou" on storage.objects;
create policy "firm-shares: ucastnici mazou" on storage.objects for delete to authenticated
  using (bucket_id = 'firm-shares' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.firm_shares s where s.path = name and s.recipient_id = auth.uid())
  ));

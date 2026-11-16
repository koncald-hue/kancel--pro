-- =====================================================================
-- AUTOMATICKÉ HLÍDÁNÍ KLIENTŮ V INSOLVENČNÍM REJSTŘÍKU
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné insolvence.sql.
--
-- Kdo má aktivní hlídání insolvence (vlastní, nebo z balíčku kanceláře), tomu se klienti s platným IČO hlídají automaticky:
-- vznikne jim hlídaná položka (označená jako automatická), denní kontrola ji zpracuje stejně jako ručně přidané osoby
-- a výsledek je vidět v seznamu klientů. Fyzické osoby bez IČO se hlídají ručně (potřebují datum narození).
-- =====================================================================
alter table public.isir_watches add column if not exists client_id uuid references public.lawyer_clients(id) on delete cascade;
alter table public.isir_watches add column if not exists auto boolean not null default false;
create index if not exists isir_watches_client_idx on public.isir_watches (client_id);

-- Limit 50 platí jen pro ručně přidané osoby; automaticky hlídaní klienti mají vlastní strop 500
create or replace function public.limit_isir_watches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.auto then
    if (select count(*) from public.isir_watches where user_id = new.user_id and auto) >= 500 then raise exception 'Automaticky lze hlídat nejvýše 500 klientů.'; end if;
  elsif (select count(*) from public.isir_watches where user_id = new.user_id and not auto) >= 50 then
    raise exception 'Ručně hlídat lze nejvýše 50 osob. Odeberte některou ze seznamu.';
  end if;
  return new;
end; $$;

-- Synchronizace: každému klientovi s IČO založí hlídání, přejmenovanému změní název, klientovi bez IČO hlídání zruší
create or replace function public.sync_client_watches(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer := 0;
begin
  if p_user is null then return 0; end if;
  -- uživatel smí synchronizovat jen sebe (službě bez přihlášení je to dovoleno)
  if auth.uid() is not null and auth.uid() <> p_user then raise exception 'Nedostatečná oprávnění.'; end if;
  if not public.has_isir(p_user) then return 0; end if;

  delete from public.isir_watches w using public.lawyer_clients c
    where w.client_id = c.id and w.auto and w.user_id = p_user and (c.ico !~ '^[0-9]{8}$');
  update public.isir_watches w set label = left(c.name, 160), ic = c.ico
    from public.lawyer_clients c
    where w.client_id = c.id and w.auto and w.user_id = p_user and c.ico ~ '^[0-9]{8}$' and (w.label is distinct from left(c.name, 160) or w.ic is distinct from c.ico);
  insert into public.isir_watches (user_id, label, kind, ic, client_id, auto)
    select c.user_id, left(c.name, 160), 'firma', c.ico, c.id, true
    from public.lawyer_clients c
    where c.user_id = p_user and c.ico ~ '^[0-9]{8}$'
      and not exists (select 1 from public.isir_watches w where w.user_id = p_user and w.kind = 'firma' and w.ic = c.ico);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.sync_client_watches(uuid) from public;
grant execute on function public.sync_client_watches(uuid) to authenticated, service_role;

-- Nový nebo upravený klient se synchronizuje hned
create or replace function public.client_watch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_isir(new.user_id) then
    if new.ico ~ '^[0-9]{8}$' then
      update public.isir_watches set label = left(new.name, 160), ic = new.ico where client_id = new.id and auto;
      if not found and not exists (select 1 from public.isir_watches w where w.user_id = new.user_id and w.kind = 'firma' and w.ic = new.ico) then
        insert into public.isir_watches (user_id, label, kind, ic, client_id, auto) values (new.user_id, left(new.name, 160), 'firma', new.ico, new.id, true);
      end if;
    else
      delete from public.isir_watches where client_id = new.id and auto;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists lawyer_clients_isir on public.lawyer_clients;
create trigger lawyer_clients_isir after insert or update of ico, name on public.lawyer_clients for each row execute function public.client_watch_trigger();

-- Co se o klientech ví: stav posledního hlídání (pro seznam klientů). Vrací jen vlastní klienty.
create or replace function public.client_insolvency_status()
returns table (client_id uuid, ic text, watched boolean, last_checked_at timestamptz, last_error text, active_count integer, ended_count integer, spis text, state text, url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.ico, wi.ids is not null, wi.lc, coalesce(wi.le, ''),
         coalesce(hh.active, 0), coalesce(hh.ended, 0), hh.spis, hh.state, hh.url
  from public.lawyer_clients c
  left join (
    select w.ic, max(w.last_checked_at) as lc, max(w.last_error) as le, array_agg(w.id) as ids
    from public.isir_watches w where w.user_id = auth.uid() and w.kind = 'firma' group by w.ic
  ) wi on wi.ic = c.ico
  left join lateral (
    select count(distinct h.spis) filter (where h.ended is null)::integer as active,
           count(distinct h.spis) filter (where h.ended is not null)::integer as ended,
           (array_agg(h.spis order by h.started desc nulls last) filter (where h.ended is null))[1] as spis,
           (array_agg(h.state order by h.started desc nulls last) filter (where h.ended is null))[1] as state,
           (array_agg(h.url order by h.started desc nulls last) filter (where h.ended is null))[1] as url
    from public.isir_hits h where h.watch_id = any(wi.ids)
  ) hh on true
  where c.user_id = auth.uid();
$$;
revoke all on function public.client_insolvency_status() from public;
grant execute on function public.client_insolvency_status() to authenticated;

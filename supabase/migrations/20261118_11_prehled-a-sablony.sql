-- =====================================================================
-- 20261118_11  PŘEHLED PRO VEDENÍ (dobrovolné sdílení hodin) A ŠABLONY ÚKOLŮ PRO NOVÉ VĚCI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: firms.sql (firms, firm_members), lawyer.sql (time_entries), 20261118_05 (mfa_ok), 20261117_01 (schema_migrations).
--
-- Hodiny podle lidí: vedoucí kanceláře vidí hodiny člena JEN když je člen sám zapnul (time_sharing.share).
-- Bez zapnutí vedoucí nevidí nic, ani součet. Člen může sdílení kdykoli vypnout. Sdílí se jen součty minut a částek
-- za období, nikdy popisy ani věci. To odpovídá slibu na stránce s cenami (data člena vedoucí nevidí).
-- Šablony: vlastní šablony úkolů (název, posun ve dnech od začátku nebo od data události, jen pracovní dny).
-- =====================================================================

create table if not exists public.time_sharing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.time_sharing enable row level security;
drop policy if exists "time_sharing_own" on public.time_sharing;
create policy "time_sharing_own" on public.time_sharing for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mfa_guard" on public.time_sharing;
create policy "mfa_guard" on public.time_sharing as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Hodiny členů pro vedoucího: jen u těch, kdo sdílení zapnuli. Ostatní se vrátí bez čísel (shared = false).
create or replace function public.team_hours(p_from date, p_to date)
returns table (user_id uuid, name text, shared boolean, minutes bigint, amount numeric, billed_minutes bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_firm uuid;
begin
  if auth.uid() is null or not public.mfa_ok() or not public.has_lawyer_access() then return; end if;
  select m.firm_id into v_firm from public.firm_members m where m.user_id = auth.uid() and m.role = 'owner';
  if v_firm is null then return; end if;
  return query
    select fm.user_id,
           coalesce(nullif(la.display_name, ''), nullif(la.email, ''), 'člen'),
           coalesce(ts.share, false) or fm.user_id = auth.uid(),
           case when coalesce(ts.share, false) or fm.user_id = auth.uid() then coalesce(sum(te.minutes), 0)::bigint end,
           case when coalesce(ts.share, false) or fm.user_id = auth.uid() then coalesce(sum(te.minutes * te.rate / 60.0), 0) end,
           case when coalesce(ts.share, false) or fm.user_id = auth.uid() then coalesce(sum(te.minutes) filter (where te.billed), 0)::bigint end
      from public.firm_members fm
      left join public.lawyer_access la on la.user_id = fm.user_id
      left join public.time_sharing ts on ts.user_id = fm.user_id
      left join public.time_entries te on te.user_id = fm.user_id and te.entry_date between p_from and p_to
                                      and (coalesce(ts.share, false) or fm.user_id = auth.uid())
     where fm.firm_id = v_firm
     group by fm.user_id, la.display_name, la.email, ts.share
     order by 4 desc nulls last;
end; $$;
revoke all on function public.team_hours(date, date) from public, anon;
grant execute on function public.team_hours(date, date) to authenticated;

-- Šablony úkolů
create table if not exists public.case_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- [{ "title": "...", "offset": 7, "base": "start" | "event", "workdays": true }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists case_templates_user_idx on public.case_templates (user_id);
alter table public.case_templates enable row level security;
drop policy if exists "case_templates_own" on public.case_templates;
create policy "case_templates_own" on public.case_templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mfa_guard" on public.case_templates;
create policy "mfa_guard" on public.case_templates as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

insert into public.schema_migrations (name) values ('20261118_11_prehled-a-sablony') on conflict do nothing;

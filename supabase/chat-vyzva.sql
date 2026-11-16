-- =====================================================================
-- VÝZVA KOLEGOVI K ZAPNUTÍ ŠIFROVANÉHO CHATU
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné chat.sql.
--
-- Zprávy jsou šifrované, takže jde psát jen kolegovi, který si šifrování zapnul. Ostatní lze vyzvat: kolega pak
-- uvidí upozornění v Chatu. Výzva nenese žádný obsah, jen to, kdo ji poslal. Stejnému kolegovi lze výzvu poslat
-- nejvýš jednou za 12 hodin.
-- =====================================================================

create table if not exists public.chat_nudges (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen boolean not null default false
);
create index if not exists chat_nudges_to_idx on public.chat_nudges (to_id, seen, created_at desc);
alter table public.chat_nudges enable row level security;
-- přímý přístup není: vše přes funkce níže
revoke all on public.chat_nudges from anon, authenticated;

create or replace function public.nudge_colleague(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_firm uuid;
begin
  if auth.uid() is null then raise exception 'Přihlaste se.'; end if;
  if p_user = auth.uid() or not public.same_firm(auth.uid(), p_user) then raise exception 'Výzvu lze poslat jen kolegovi z kanceláře.'; end if;
  select firm_id into v_firm from public.firm_members where user_id = auth.uid();
  if exists (select 1 from public.chat_nudges where from_id = auth.uid() and to_id = p_user and created_at > now() - interval '12 hours') then
    return 'already';
  end if;
  insert into public.chat_nudges (firm_id, from_id, to_id) values (v_firm, auth.uid(), p_user);
  return 'sent';
end;
$$;
revoke all on function public.nudge_colleague(uuid) from public;
grant execute on function public.nudge_colleague(uuid) to authenticated;

-- Moje nevyřízené výzvy (od koho)
create or replace function public.my_nudges()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('from_id', n.from_id, 'name', coalesce(nullif(la.display_name, ''), la.email, 'Kolega'), 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
  from (select distinct on (from_id) from_id, created_at from public.chat_nudges where to_id = auth.uid() and not seen order by from_id, created_at desc) n
  left join public.lawyer_access la on la.user_id = n.from_id;
$$;
revoke all on function public.my_nudges() from public;
grant execute on function public.my_nudges() to authenticated;

create or replace function public.dismiss_nudges()
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_nudges set seen = true where to_id = auth.uid() and not seen;
$$;
revoke all on function public.dismiss_nudges() from public;
grant execute on function public.dismiss_nudges() to authenticated;

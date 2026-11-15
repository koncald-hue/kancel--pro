-- =====================================================================
-- STATISTIKY PRO SPRÁVCE
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné všechny ostatní soubory (lawyer.sql, verification-billing.sql ...).
--
-- Funkce admin_stats() vrací souhrn jedním dotazem a smí ji zavolat jen člen týmu (ostatním vrátí chybu).
-- Vrací JEN počty a součty. Žádná jména, e-maily ani obsah spisů a zpráv nevrací.
-- =====================================================================

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Přístup jen pro tým.';
  end if;

  return jsonb_build_object(
    'generated_at', now(),

    'users', (
      select jsonb_build_object(
        'registered', count(*),
        'new_7d', count(*) filter (where created_at > now() - interval '7 days'),
        'new_30d', count(*) filter (where created_at > now() - interval '30 days'),
        'unconfirmed', count(*) filter (where email_confirmed_at is null)
      )
      from auth.users
      where id not in (select user_id from public.staff)
    ),

    'access', (
      select jsonb_build_object(
        'trial', count(*) filter (where status = 'trial' and (until is null or until >= current_date)),
        'active', count(*) filter (where status = 'active' and (until is null or until >= current_date)),
        'expired', count(*) filter (where status in ('trial', 'active') and until < current_date),
        'requested', count(*) filter (where status = 'requested'),
        'verified', count(*) filter (where verification_status = 'verified'),
        'pending_verification', count(*) filter (where verification_status = 'pending'),
        'rejected', count(*) filter (where verification_status = 'rejected'),
        'trial_ending_7d', count(*) filter (where status = 'trial' and until between current_date and current_date + 7)
      )
      from public.lawyer_access
      where user_id not in (select user_id from public.staff)
    ),

    'orders', (
      select jsonb_build_object(
        'total', count(*),
        'paid', count(*) filter (where status = 'paid'),
        'pending', count(*) filter (where status = 'pending'),
        'refund_due', count(*) filter (where status = 'refund_due'),
        'revenue_total', coalesce(sum(price_czk) filter (where status = 'paid'), 0),
        'revenue_7d', coalesce(sum(price_czk) filter (where status = 'paid' and coalesce(paid_at, created_at) > now() - interval '7 days'), 0),
        'revenue_30d', coalesce(sum(price_czk) filter (where status = 'paid' and coalesce(paid_at, created_at) > now() - interval '30 days'), 0),
        'paid_month', count(*) filter (where status = 'paid' and plan = 'month'),
        'paid_half', count(*) filter (where status = 'paid' and plan = 'half'),
        'paid_year', count(*) filter (where status = 'paid' and plan = 'year'),
        'buyers', count(distinct user_id) filter (where status = 'paid'),
        'repeat_buyers', (select count(*) from (select user_id from public.lawyer_orders where status = 'paid' group by user_id having count(*) >= 2) r)
      )
      from public.lawyer_orders
    ),

    -- posledních 30 dní: nové registrace a tržby
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'signups', coalesce(u.cnt, 0),
        'revenue', coalesce(o.rev, 0)
      ) order by d.day), '[]'::jsonb)
      from (select generate_series(current_date - 29, current_date, interval '1 day')::date as day) d
      left join (
        select created_at::date as day, count(*) as cnt
        from auth.users
        where id not in (select user_id from public.staff)
        group by 1
      ) u on u.day = d.day
      left join (
        select coalesce(paid_at, created_at)::date as day, sum(price_czk) as rev
        from public.lawyer_orders where status = 'paid' group by 1
      ) o on o.day = d.day
    ),

    -- jen celkové počty, žádný obsah
    'usage', jsonb_build_object(
      'cases', (select count(*) from public.cases),
      'files', (select count(*) from public.case_files),
      'files_mb', (select coalesce(round(sum(size) / 1048576.0), 0) from public.case_files),
      'client_links', (select count(*) from public.client_links where not revoked),
      'lawyers_with_case', (select count(distinct user_id) from public.cases)
    )
  );
end;
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

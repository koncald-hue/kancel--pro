-- =====================================================================
-- INFORMACE O POZVÁNCE PRO STRÁNKU S POZVÁNKOU
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné firms.sql.
--
-- Kdo zná tajný kód pozvánky, uvidí název kanceláře a zkrácený e-mail, na který byla vystavena (např. j***@firma.cz).
-- Samotnou pozvánku ale smí přijmout jen účet s přesně tímto e-mailem.
-- =====================================================================

create or replace function public.firm_invite_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'firm', f.name,
    'email_hint', left(split_part(i.email, '@', 1), 1) || '***@' || split_part(i.email, '@', 2)
  )
  from public.firm_invites i join public.firms f on f.id = i.firm_id
  where i.token = coalesce(p_token, '') and not i.revoked and i.accepted_at is null and i.expires_at > now();
$$;
revoke all on function public.firm_invite_info(text) from public;
grant execute on function public.firm_invite_info(text) to anon, authenticated;

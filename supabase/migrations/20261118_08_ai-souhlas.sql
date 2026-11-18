-- =====================================================================
-- 20261118_08  SOUHLAS S AI ASISTENTEM
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: lawyer.sql, 20261117_01.
-- Funkce „Asistent (AI)“ ve věci posílá vybraný text poskytovateli AI (OpenAI) mimo databázi Kanceláře. Proto je vypnutá,
-- dokud advokát výslovně neudělí souhlas. Čas souhlasu se ukládá a lze ho kdykoli odvolat. Souhlas kontroluje i server.
-- =====================================================================
alter table public.lawyer_access add column if not exists ai_consent_at timestamptz;

create or replace function public.set_ai_consent(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_lawyer_access() then raise exception 'Nejdřív musí být aktivní předplatné.'; end if;
  update public.lawyer_access set ai_consent_at = case when p_on then now() else null end where user_id = auth.uid();
end; $$;
revoke all on function public.set_ai_consent(boolean) from public, anon;
grant execute on function public.set_ai_consent(boolean) to authenticated;

insert into public.schema_migrations (name) values ('20261118_08_ai-souhlas') on conflict do nothing;

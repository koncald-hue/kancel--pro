-- =====================================================================
-- 20261118_07  VZHLED KLIENTSKÉ STRÁNKY (barva a uvítání)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: lawyer.sql, 20261117_01 (schema_migrations).
-- Přidá dva sloupce k profilu advokáta (barva z pevné nabídky, krátké uvítání) a funkci, kterou si je advokát nastavuje sám.
-- Barva je jen volba z pevného seznamu, aby se do stránky klienta nedalo vložit cizí styl.
-- =====================================================================
alter table public.lawyer_access add column if not exists portal_accent text not null default 'indigo';
alter table public.lawyer_access drop constraint if exists lawyer_access_portal_accent_check;
alter table public.lawyer_access add constraint lawyer_access_portal_accent_check check (portal_accent in ('indigo', 'emerald', 'rose', 'amber', 'sky', 'slate'));
alter table public.lawyer_access add column if not exists portal_greeting text not null default '';
alter table public.lawyer_access drop constraint if exists lawyer_access_portal_greeting_check;
alter table public.lawyer_access add constraint lawyer_access_portal_greeting_check check (char_length(portal_greeting) <= 300);

create or replace function public.save_portal_branding(p_accent text, p_greeting text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_lawyer_access() then raise exception 'Nejdřív musí být aktivní předplatné.'; end if;
  if p_accent not in ('indigo', 'emerald', 'rose', 'amber', 'sky', 'slate') then raise exception 'Neznámá barva.'; end if;
  update public.lawyer_access set portal_accent = p_accent, portal_greeting = left(coalesce(p_greeting, ''), 300) where user_id = auth.uid();
end; $$;
revoke all on function public.save_portal_branding(text, text) from public, anon;
grant execute on function public.save_portal_branding(text, text) to authenticated;

insert into public.schema_migrations (name) values ('20261118_07_vzhled-klientske-stranky') on conflict do nothing;

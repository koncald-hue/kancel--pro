-- =====================================================================
-- FOTKA PROFILU A PROFIL KOLEGY
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné role.sql.
--
-- Fotka se v prohlížeči zmenší a uloží ve dvou velikostech: miniatura (chat, seznamy) a větší (profil).
-- Fotku vidí kolegové z kanceláře a klienti, kterým advokát zpřístupnil svou stránku. Není to end-to-end
-- šifrované (je to veřejná vizitka). Profil kolegy ukazuje jen jméno, roli, profesi, evidenční číslo, adresu
-- kanceláře, telefon, kontaktní e-mail, web a fotku. Fakturační údaje a ostatní osobní nastavení nikdy.
-- =====================================================================

alter table public.lawyer_access add column if not exists avatar_small text not null default '' check (char_length(avatar_small) <= 20000);
alter table public.lawyer_access add column if not exists avatar_large text not null default '' check (char_length(avatar_large) <= 150000);

create or replace function public.save_avatar(p_small text, p_large text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_small !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' or p_large !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then raise exception 'Fotka musí být obrázek JPEG.'; end if;
  if char_length(p_small) > 20000 or char_length(p_large) > 150000 then raise exception 'Fotka je příliš velká.'; end if;
  update public.lawyer_access set avatar_small = p_small, avatar_large = p_large where user_id = auth.uid();
  if not found then raise exception 'Nejdřív zahajte zkušební přístup.'; end if;
end;
$$;
revoke all on function public.save_avatar(text, text) from public;
grant execute on function public.save_avatar(text, text) to authenticated;

create or replace function public.remove_avatar()
returns void
language sql
security definer
set search_path = public
as $$
  update public.lawyer_access set avatar_small = '', avatar_large = '' where user_id = auth.uid();
$$;
revoke all on function public.remove_avatar() from public;
grant execute on function public.remove_avatar() to authenticated;

-- Kolegové: přidána miniatura
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
      'role', m.role,
      'avatar', coalesce(la.avatar_small, ''),
      'has_keys', exists (select 1 from public.member_keys k where k.user_id = m.user_id)
    ) order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, coalesce(nullif(la.display_name, ''), la.email)), '[]'::jsonb)
    from public.firm_members m left join public.lawyer_access la on la.user_id = m.user_id
    where m.firm_id = v_firm and m.user_id <> auth.uid()
  );
end;
$$;
revoke all on function public.firm_colleagues() from public;
grant execute on function public.firm_colleagues() to authenticated;

-- Profil kolegy po rozkliknutí (jen z téže kanceláře, jen vybrané údaje)
create or replace function public.colleague_profile(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if p_user <> auth.uid() and not public.same_firm(auth.uid(), p_user) then raise exception 'Profil je dostupný jen kolegům z kanceláře.'; end if;
  select jsonb_build_object(
    'user_id', la.user_id,
    'name', coalesce(nullif(la.display_name, ''), la.email, ''),
    'role', m.role,
    'firm', f.name,
    'profession', la.profession,
    'bar_number', la.bar_number,
    'office', la.office,
    'phone', la.phone,
    'email', coalesce(nullif(la.contact_email, ''), la.email),
    'website', la.website,
    'photo', la.avatar_large
  ) into r
  from public.lawyer_access la
  left join public.firm_members m on m.user_id = la.user_id
  left join public.firms f on f.id = m.firm_id
  where la.user_id = p_user;
  return r;
end;
$$;
revoke all on function public.colleague_profile(uuid) from public;
grant execute on function public.colleague_profile(uuid) to authenticated;

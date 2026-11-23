-- =====================================================================
-- 20261123_37  KATALOG: VŠICHNI ADVOKÁTI AUTOMATICKY (s možností vypnout)
-- Spusť v Supabase Kanceláře po 20261123_35. Jde spustit i opakovaně.
-- V katalogu na studujpravo.cz je každý advokát s vyplněným profilem a aktivním přístupem, dokud si zobrazení
-- nevypne v Nastavení -> Noví klienti. Bez vybraných oborů a krajů se ukazuje u všech oborů a v celé ČR.
-- =====================================================================

alter table public.lawyer_access alter column directory_listed set default true;
-- Kdo si katalog výslovně vypnul (odlišení od výchozího stavu, aby ho hromadné zapnutí nepřepsalo)
alter table public.lawyer_access add column if not exists directory_opted_out_at timestamptz;
update public.lawyer_access set directory_listed = true where directory_listed = false and directory_opted_out_at is null;

create or replace function public.save_directory(p_listed boolean, p_areas text[], p_regions text[], p_consult text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
declare
  allowed_areas text[] := array['obcanske-pravo','bydleni','prace','spotrebitel','rodina','urady','trestni-pravo','obchodni-pravo'];
  allowed_regions text[] := array['Hlavní město Praha','Středočeský kraj','Jihočeský kraj','Plzeňský kraj','Karlovarský kraj','Ústecký kraj','Liberecký kraj','Královéhradecký kraj','Pardubický kraj','Kraj Vysočina','Jihomoravský kraj','Olomoucký kraj','Zlínský kraj','Moravskoslezský kraj'];
begin
  if auth.uid() is null or not public.has_lawyer_access() then raise exception 'Nejdřív musí být aktivní předplatné.'; end if;
  if not (coalesce(p_areas, '{}') <@ allowed_areas) then raise exception 'Neznámý obor.'; end if;
  if not (coalesce(p_regions, '{}') <@ allowed_regions) then raise exception 'Neznámý kraj.'; end if;
  update public.lawyer_access set
    directory_listed = coalesce(p_listed, false),
    directory_opted_out_at = case when coalesce(p_listed, false) then null else now() end,
    directory_areas = coalesce(p_areas, '{}'),
    directory_regions = coalesce(p_regions, '{}'),
    directory_consult = left(coalesce(p_consult, ''), 120),
    directory_bio = left(coalesce(p_bio, ''), 600)
  where user_id = auth.uid();
end; $$;
revoke all on function public.save_directory(boolean, text[], text[], text, text) from public, anon;
grant execute on function public.save_directory(boolean, text[], text[], text, text) to authenticated;

insert into public.schema_migrations (name) values ('20261123_37_katalog-vsichni-advokati') on conflict do nothing;

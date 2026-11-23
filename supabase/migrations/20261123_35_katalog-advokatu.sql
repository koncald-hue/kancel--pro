-- =====================================================================
-- KATALOG ADVOKÁTŮ NA STUDUJ PRÁVO + POPTÁVKY ODTUD + KÓD PRO INZERCI
-- Spustit v Supabase Kanceláře (SQL Editor -> New query -> vložit -> Run). Jde spustit opakovaně.
--
-- Advokát si v Nastavení -> Noví klienti zapne zobrazení v katalogu na studujpravo.cz, vybere obory a kraje.
-- Lidé z poradny Studuj právo si advokáta vyberou sami a poptávka mu přijde do Poptávek se štítkem „Studuj právo“.
-- Katalog je součást předplatného (žádná platba za poptávku ani podíl z odměny).
-- =====================================================================

alter table public.lawyer_access add column if not exists directory_listed boolean not null default false;
alter table public.lawyer_access add column if not exists directory_areas text[] not null default '{}';
alter table public.lawyer_access add column if not exists directory_regions text[] not null default '{}';
alter table public.lawyer_access add column if not exists directory_consult text not null default '';
alter table public.lawyer_access add column if not exists directory_bio text not null default '';
-- Veřejné ID advokáta v katalogu (interní user_id se ven neposílá)
alter table public.lawyer_access add column if not exists directory_id uuid not null default gen_random_uuid();
create unique index if not exists lawyer_access_directory_id_idx on public.lawyer_access (directory_id);
-- Kód, kterým předplatitel inzeruje na Studuj právo zdarma
alter table public.lawyer_access add column if not exists job_code text;
create unique index if not exists lawyer_access_job_code_idx on public.lawyer_access (job_code) where job_code is not null;

alter table public.lawyer_inquiries add column if not exists source text not null default 'direct';
alter table public.lawyer_inquiries add column if not exists source_ref text;
alter table public.lawyer_inquiries add column if not exists area text;
alter table public.lawyer_inquiries add column if not exists region text;
alter table public.lawyer_inquiries add column if not exists district text;
alter table public.lawyer_inquiries add column if not exists decided_at timestamptz;
create index if not exists lawyer_inquiries_source_ref_idx on public.lawyer_inquiries (source_ref) where source_ref is not null;

-- Nové stavy: uzavřená (vyřízená nebo bez spolupráce) a vypršelá (advokát nereagoval 5 dní)
alter table public.lawyer_inquiries drop constraint if exists lawyer_inquiries_status_check;
alter table public.lawyer_inquiries add constraint lawyer_inquiries_status_check check (status in ('new', 'accepted', 'declined', 'closed', 'expired'));

-- Uložení nastavení katalogu advokátem
create or replace function public.save_directory(p_listed boolean, p_areas text[], p_regions text[], p_consult text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
declare
  allowed_areas text[] := array['obcanske-pravo','bydleni','prace','spotrebitel','rodina','urady','trestni-pravo','obchodni-pravo'];
  allowed_regions text[] := array['Hlavní město Praha','Středočeský kraj','Jihočeský kraj','Plzeňský kraj','Karlovarský kraj','Ústecký kraj','Liberecký kraj','Královéhradecký kraj','Pardubický kraj','Kraj Vysočina','Jihomoravský kraj','Olomoucký kraj','Zlínský kraj','Moravskoslezský kraj'];
begin
  if auth.uid() is null or not public.has_lawyer_access() then raise exception 'Nejdřív musí být aktivní předplatné.'; end if;
  if not (coalesce(p_areas, '{}') <@ allowed_areas) then raise exception 'Neznámý obor.'; end if;
  if not (coalesce(p_regions, '{}') <@ allowed_regions) then raise exception 'Neznámý kraj.'; end if;
  if p_listed and (cardinality(coalesce(p_areas, '{}')) = 0 or cardinality(coalesce(p_regions, '{}')) = 0) then
    raise exception 'Vyberte aspoň jeden obor a jeden kraj.';
  end if;
  update public.lawyer_access set
    directory_listed = coalesce(p_listed, false),
    directory_areas = coalesce(p_areas, '{}'),
    directory_regions = coalesce(p_regions, '{}'),
    directory_consult = left(coalesce(p_consult, ''), 120),
    directory_bio = left(coalesce(p_bio, ''), 600)
  where user_id = auth.uid();
end; $$;
revoke all on function public.save_directory(boolean, text[], text[], text, text) from public, anon;
grant execute on function public.save_directory(boolean, text[], text[], text, text) to authenticated;

-- Vytvoření (nebo zobrazení) kódu pro inzerci zdarma
create or replace function public.ensure_job_code()
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null or not public.has_lawyer_access() then raise exception 'Nejdřív musí být aktivní předplatné.'; end if;
  select job_code into c from public.lawyer_access where user_id = auth.uid();
  if c is null then
    c := 'KP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    update public.lawyer_access set job_code = c where user_id = auth.uid();
  end if;
  return c;
end; $$;
revoke all on function public.ensure_job_code() from public, anon;
grant execute on function public.ensure_job_code() to authenticated;

insert into public.schema_migrations (name) values ('20261123_35_katalog-advokatu') on conflict do nothing;

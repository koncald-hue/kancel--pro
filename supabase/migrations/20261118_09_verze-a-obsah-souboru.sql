-- =====================================================================
-- 20261118_09  VERZE DOKUMENTŮ A VYHLEDÁVÁNÍ V OBSAHU SOUBORŮ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: case-files.sql, sdilene-veci.sql (can_read_case), hledani.sql (public.norm), 20261117_01.
--
-- 1) Verze: soubor lze nahrát jako novou verzi dřívějšího (starší zůstane). Sloupce version_of a version.
-- 2) Obsah: z nešifrovaných souborů (txt, csv, md, html, docx) se v prohlížeči advokáta vytáhne text a uloží do case_file_text,
--    aby šel hledat. U PDF a skenů se text zatím nevytahuje. Šifrované soubory (end-to-end) se NEINDEXUJÍ, server jejich obsah nezná.
--    Text dostane jen ten, kdo smí číst věc (stejná pravidla jako u souborů).
-- =====================================================================
alter table public.case_files add column if not exists version_of uuid references public.case_files(id) on delete set null;
alter table public.case_files add column if not exists version integer not null default 1 check (version >= 1);
create index if not exists case_files_version_idx on public.case_files (version_of);

create table if not exists public.case_file_text (
  file_id uuid primary key references public.case_files(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 300000),
  tsv tsvector,
  created_at timestamptz not null default now()
);
create index if not exists case_file_text_case_idx on public.case_file_text (case_id);
create index if not exists case_file_text_tsv_idx on public.case_file_text using gin (tsv);

create or replace function public.case_file_text_tsv()
returns trigger language plpgsql set search_path = public, extensions as $$
begin new.tsv := to_tsvector('simple', public.norm(new.body)); return new; end; $$;
drop trigger if exists case_file_text_tsv on public.case_file_text;
create trigger case_file_text_tsv before insert or update of body on public.case_file_text for each row execute function public.case_file_text_tsv();

alter table public.case_file_text enable row level security;
revoke all on public.case_file_text from public, anon;
grant select, insert, update, delete on public.case_file_text to authenticated;
drop policy if exists "case_file_text_read" on public.case_file_text;
create policy "case_file_text_read" on public.case_file_text for select to authenticated using (public.can_read_case(case_id));
drop policy if exists "case_file_text_insert" on public.case_file_text;
create policy "case_file_text_insert" on public.case_file_text for insert to authenticated with check (user_id = auth.uid() and public.can_write_case(case_id) and exists (select 1 from public.case_files f where f.id = file_id and f.case_id = case_file_text.case_id and not coalesce(f.enc, false)));
drop policy if exists "case_file_text_update" on public.case_file_text;
create policy "case_file_text_update" on public.case_file_text for update to authenticated using (user_id = auth.uid() and public.can_write_case(case_id)) with check (user_id = auth.uid() and public.can_write_case(case_id));
drop policy if exists "case_file_text_delete" on public.case_file_text;
create policy "case_file_text_delete" on public.case_file_text for delete to authenticated using (public.can_write_case(case_id));

-- Hledání v obsahu: každé zadané slovo (alespoň 3 znaky) jako předpona, všechna musí sedět. Bez diakritiky a bez ohledu na velikost písmen.
create or replace function public.search_file_text(p_q text)
returns table (file_id uuid, case_id uuid, case_title text, file_name text, snippet text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_query tsquery; v_terms text;
begin
  if auth.uid() is null or not public.mfa_ok() or not public.has_lawyer_access() then return; end if;
  select string_agg(w || ':*', ' & ') into v_terms from (select distinct w from regexp_split_to_table(regexp_replace(public.norm(left(coalesce(p_q, ''), 200)), '[^a-z0-9]+', ' ', 'g'), ' ') as w where char_length(w) >= 3 limit 6) s;
  if v_terms is null then return; end if;
  v_query := to_tsquery('simple', v_terms);
  return query
    select t.file_id, t.case_id, c.title, f.name,
           ts_headline('simple', t.body, plainto_tsquery('simple', public.norm(p_q)), 'MaxWords=24, MinWords=8, ShortWord=2, MaxFragments=1')
      from public.case_file_text t
      join public.case_files f on f.id = t.file_id
      join public.cases c on c.id = t.case_id
     where t.tsv @@ v_query and public.can_read_case(t.case_id)
     order by ts_rank(t.tsv, v_query) desc
     limit 15;
end; $$;
revoke all on function public.search_file_text(text) from public, anon;
grant execute on function public.search_file_text(text) to authenticated;

-- Druhý faktor (migrace 05) platí i pro text souborů
drop policy if exists "mfa_guard" on public.case_file_text;
create policy "mfa_guard" on public.case_file_text as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

insert into public.schema_migrations (name) values ('20261118_09_verze-a-obsah-souboru') on conflict do nothing;

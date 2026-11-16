-- =====================================================================
-- FULLTEXTOVÉ HLEDÁNÍ NAPŘÍČ KANCELÁŘÍ
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Hledá se bez ohledu na velikost písmen a diakritiku (např. „novak“ najde „Novák“) ve věcech, klientech,
-- zápisech a poznámkách, kontaktech, datových zprávách uložených ve věcech, názvech souborů, lhůtách, poptávkách, vzorech, výkazech, fakturách a nemovitostech.
-- Funkce běží s právy přihlášeného, takže najde jen to, co smí vidět (vlastní data a sdílené vzory kolegů).
-- Šifrovaný obsah (zprávy klientů, chat, šifrované názvy souborů) se prohledat nedá, server ho nevidí.
-- =====================================================================
create extension if not exists unaccent with schema extensions;

create or replace function public.norm(t text)
returns text language sql stable set search_path = public, extensions as $$ select lower(extensions.unaccent(coalesce(t, ''))) $$;

-- Úryvek okolo nalezeného textu
create or replace function public.snip(src text, q text)
returns text language plpgsql stable set search_path = public, extensions as $$
declare p integer; s text := regexp_replace(coalesce(src, ''), '\s+', ' ', 'g');
begin
  p := position(q in public.norm(s));
  if p = 0 then return left(s, 140); end if;
  return case when p > 40 then '…' else '' end || substr(s, greatest(p - 40, 1), 150) || case when length(s) > p + 110 then '…' else '' end;
end; $$;

create or replace function public.search_all(p_q text)
returns table (kind text, id uuid, case_id uuid, title text, snippet text, rank integer)
language plpgsql
stable
set search_path = public, extensions
as $$
declare q text := public.norm(btrim(coalesce(p_q, '')));
begin
  if char_length(q) < 2 then return; end if;
  return query
  (select 'vec'::text, c.id, c.id, c.title, public.snip(concat_ws(' · ', nullif(c.client_name, ''), nullif(c.reference, ''), nullif(c.authority, ''), c.situation, c.summary, c.note), q),
     case when position(q in public.norm(c.title)) > 0 then 1 else 2 end
   from public.cases c
   where position(q in public.norm(concat_ws(' ', c.title, c.client_name, c.client_email, c.client_phone, c.reference, c.authority, c.situation, c.summary, c.note))) > 0 limit 10)
  union all
  (select 'klient', k.id, null::uuid, k.name, public.snip(concat_ws(' · ', nullif(k.email, ''), nullif(k.phone, ''), nullif(k.ico, ''), nullif(k.address, ''), k.note), q),
     case when position(q in public.norm(k.name)) > 0 then 1 else 2 end
   from public.lawyer_clients k
   where position(q in public.norm(concat_ws(' ', k.name, k.email, k.phone, k.ico, k.dic, k.address, k.note))) > 0 limit 10)
  union all
  (select 'zapis', e.id, e.case_id, e.title, public.snip(e.body, q), case when position(q in public.norm(e.title)) > 0 then 1 else 2 end
   from public.case_entries e where position(q in public.norm(concat_ws(' ', e.title, e.body))) > 0 limit 10)
  union all
  (select 'kontakt', o.id, o.case_id, o.name, public.snip(concat_ws(' · ', o.role, nullif(o.email, ''), nullif(o.phone, ''), o.note), q), 2
   from public.case_contacts o where position(q in public.norm(concat_ws(' ', o.name, o.role, o.email, o.phone, o.note))) > 0 limit 8)
  union all
  (select 'soubor', f.id, f.case_id, f.name, public.snip(f.note, q), 2
   from public.case_files f where not coalesce(f.enc, false) and position(q in public.norm(concat_ws(' ', f.name, f.note))) > 0 limit 8)
  union all
  (select 'lhuta', d.id, d.case_id, d.title, 'Termín ' || to_char(d.due_date, 'DD. MM. YYYY'), 2
   from public.case_deadlines d where position(q in public.norm(d.title)) > 0 limit 6)
  union all
  (select 'poptavka', i.id, null::uuid, i.name, public.snip(concat_ws(' · ', nullif(i.email, ''), nullif(i.phone, ''), i.message), q), 2
   from public.lawyer_inquiries i where position(q in public.norm(concat_ws(' ', i.name, i.email, i.phone, i.message))) > 0 limit 6)
  union all
  (select 'vzor', t.id, null::uuid, t.title, public.snip(concat_ws(' · ', nullif(t.category, ''), t.body), q), case when position(q in public.norm(t.title)) > 0 then 1 else 2 end
   from public.lawyer_templates t where position(q in public.norm(concat_ws(' ', t.title, t.category, t.body))) > 0 limit 6)
  union all
  (select 'vykaz', x.id, x.case_id, x.description, to_char(x.entry_date, 'DD. MM. YYYY') || ' · ' || x.minutes || ' min', 2
   from public.time_entries x where position(q in public.norm(x.description)) > 0 limit 6)
  union all
  (select 'faktura', v.id, v.case_id, coalesce(nullif(v.number, ''), 'Koncept') || coalesce(' · ' || nullif(v.title, ''), ''), public.snip(concat_ws(' · ', v.client_snapshot ->> 'name', v.note), q), 2
   from public.invoices v where position(q in public.norm(concat_ws(' ', v.number, v.title, v.note, v.client_snapshot ->> 'name', v.client_snapshot ->> 'ico'))) > 0 limit 6)
  union all
  (select 'datovka', d.id, d.case_id, d.annotation, public.snip(concat_ws(' · ', case when d.direction = 'received' then 'od ' || d.sender else 'komu ' || d.recipient end, 'ID ' || d.dm_id), q), 2
   from public.case_data_messages d where position(q in public.norm(concat_ws(' ', d.annotation, d.sender, d.recipient, d.dm_id))) > 0 limit 8)
  union all
  (select 'nemovitost', p.id, p.case_id, p.label, null::text, 2
   from public.case_properties p where position(q in public.norm(p.label)) > 0 limit 6);
end;
$$;
revoke all on function public.search_all(text) from public;
grant execute on function public.search_all(text) to authenticated;
revoke all on function public.norm(text) from public;
grant execute on function public.norm(text) to authenticated;
revoke all on function public.snip(text, text) from public;
grant execute on function public.snip(text, text) to authenticated;

-- =====================================================================
-- POVINNÝ PROFIL MÍSTO OVĚŘOVÁNÍ TOTOŽNOSTI
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
--
-- Ruční ověřování advokátů (nahrávání průkazu, schvalování týmem) se ruší. Místo toho musí každý advokát
-- před použitím aplikace vyplnit svůj profil (jméno, profese, evidenční číslo ČAK, kancelář, telefon, e-mail).
-- Tým vidí přehled všech uživatelů s jejich profily.
--
-- Technická poznámka: sloupec lawyer_access.verification_status zůstává; hodnota 'verified' teď znamená
-- „profil je vyplněný“ (klientské odkazy, poptávky a nákup předplatného na ni navazují).
-- =====================================================================

alter table public.lawyer_access add column if not exists website text not null default '';

create or replace function public.save_lawyer_profile(p_name text, p_profession text, p_bar text, p_office text, p_phone text, p_email text, p_website text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_bar text := btrim(coalesce(p_bar, ''));
  v_office text := btrim(coalesce(p_office, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.uid() is null then raise exception 'Přihlaste se.'; end if;
  if p_profession not in ('advokat', 'jiny') then raise exception 'Zvolte, zda jste advokát, nebo jiný právník.'; end if;
  if char_length(v_name) < 5 or v_name !~ '\s' then raise exception 'Vyplňte celé jméno a příjmení.'; end if;
  if p_profession = 'advokat' and char_length(v_bar) < 3 then raise exception 'Advokát musí vyplnit evidenční číslo ČAK.'; end if;
  if char_length(v_office) < 5 then raise exception 'Vyplňte adresu kanceláře.'; end if;
  if char_length(regexp_replace(v_phone, '\D', '', 'g')) < 9 then raise exception 'Vyplňte telefon (alespoň 9 číslic).'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Vyplňte platný e-mail pro klienty.'; end if;

  update public.lawyer_access set
    display_name = v_name, register_name = v_name,
    profession = p_profession, bar_number = left(v_bar, 40),
    office = left(v_office, 200), phone = left(v_phone, 40), contact_email = left(v_email, 200),
    website = left(btrim(coalesce(p_website, '')), 200),
    verification_status = 'verified',
    verified_at = coalesce(verified_at, now())
  where user_id = auth.uid();
  if not found then raise exception 'Nejdřív zahajte zkušební přístup.'; end if;
end;
$$;
revoke all on function public.save_lawyer_profile(text, text, text, text, text, text, text) from public;
grant execute on function public.save_lawyer_profile(text, text, text, text, text, text, text) to authenticated;

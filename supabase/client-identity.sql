-- =====================================================================
-- PROFIL ADVOKÁTA A IDENTITA KLIENTA
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné lawyer.sql a client-portal.sql.
-- =====================================================================

-- Kontaktní údaje, které advokát ukazuje klientům (nic se neukazuje, dokud je sám nevyplní)
alter table public.lawyer_access add column if not exists display_name text not null default '';
alter table public.lawyer_access add column if not exists phone text not null default '';
alter table public.lawyer_access add column if not exists office text not null default '';
alter table public.lawyer_access add column if not exists website text not null default '';
alter table public.lawyer_access add column if not exists bar_number text not null default '';
alter table public.lawyer_access add column if not exists contact_email text not null default '';

-- Údaje, které o sobě klient vyplní před prvním vstupem do věci
alter table public.client_links add column if not exists client_name text not null default '';
alter table public.client_links add column if not exists client_email text not null default '';
alter table public.client_links add column if not exists client_phone text not null default '';
alter table public.client_links add column if not exists client_address text not null default '';
alter table public.client_links add column if not exists consent_at timestamptz;
alter table public.client_links add column if not exists onboarded_at timestamptz;

create or replace function public.update_lawyer_public_profile(p_name text, p_phone text, p_office text, p_web text, p_bar text, p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lawyer_access set
    display_name = left(coalesce(p_name, ''), 120),
    phone = left(coalesce(p_phone, ''), 40),
    office = left(coalesce(p_office, ''), 200),
    website = left(coalesce(p_web, ''), 200),
    bar_number = left(coalesce(p_bar, ''), 40),
    contact_email = left(coalesce(p_email, ''), 160)
  where user_id = auth.uid();
$$;
revoke all on function public.update_lawyer_public_profile(text, text, text, text, text, text) from public;
grant execute on function public.update_lawyer_public_profile(text, text, text, text, text, text) to authenticated;

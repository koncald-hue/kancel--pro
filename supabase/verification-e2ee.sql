-- =====================================================================
-- OVĚŘENÍ TOTOŽNOSTI ADVOKÁTA A END-TO-END ŠIFROVÁNÍ KOMUNIKACE S KLIENTEM
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné lawyer.sql, client-portal.sql a client-identity.sql.
-- =====================================================================

-- Ověření advokáta: žádost podá uživatel, schvaluje tým po kontrole v seznamu ČAK
alter table public.lawyer_access add column if not exists profession text not null default 'advokat' check (profession in ('advokat', 'jiny'));
alter table public.lawyer_access add column if not exists verification_status text not null default 'none' check (verification_status in ('none', 'pending', 'verified', 'rejected'));
alter table public.lawyer_access add column if not exists register_name text not null default '';
alter table public.lawyer_access add column if not exists verified_at timestamptz;
alter table public.lawyer_access add column if not exists verification_note text not null default '';

-- Klíče end-to-end: hlavní klíč advokáta je zašifrovaný jeho heslem ještě v prohlížeči, server vidí jen zašifrovaný balík
alter table public.lawyer_access add column if not exists e2ee_salt text;
alter table public.lawyer_access add column if not exists e2ee_wrapped_master text;

-- Klientský odkaz: šifrovaný režim, klíč odkazu zabalený hlavním klíčem advokáta a potvrzení identity klienta advokátem
alter table public.client_links add column if not exists e2ee boolean not null default false;
alter table public.client_links add column if not exists wrapped_key text;
alter table public.client_links add column if not exists client_verified_at timestamptz;

-- Šifrovaný soubor: obsah i název jsou zašifrované, server vidí jen náhodná data
alter table public.case_files add column if not exists enc boolean not null default false;

create or replace function public.request_lawyer_verification(p_profession text, p_register_name text, p_bar text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lawyer_access set
    profession = case when p_profession = 'jiny' then 'jiny' else 'advokat' end,
    register_name = left(coalesce(p_register_name, ''), 160),
    bar_number = left(coalesce(p_bar, ''), 40),
    verification_status = 'pending',
    verification_note = ''
  where user_id = auth.uid() and verification_status <> 'verified';
$$;
revoke all on function public.request_lawyer_verification(text, text, text) from public;
grant execute on function public.request_lawyer_verification(text, text, text) to authenticated;

create or replace function public.set_e2ee_keys(p_salt text, p_wrapped text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lawyer_access set e2ee_salt = left(p_salt, 200), e2ee_wrapped_master = left(p_wrapped, 400) where user_id = auth.uid();
$$;
revoke all on function public.set_e2ee_keys(text, text) from public;
grant execute on function public.set_e2ee_keys(text, text) to authenticated;

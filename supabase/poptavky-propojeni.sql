-- =====================================================================
-- POPTÁVKA -> VĚC: propojení přijaté poptávky s vytvořenou věcí
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Po přijetí se věc a klient (jméno, e-mail, telefon) zakládají automaticky díky fakturace.sql.
-- Tady se jen pamatuje, ze které poptávky věc vznikla, aby odkaz na ni zůstal i po znovunačtení.
-- =====================================================================
alter table public.lawyer_inquiries add column if not exists case_id uuid references public.cases(id) on delete set null;

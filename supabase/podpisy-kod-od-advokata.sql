-- Podpis bez placené SMS brány: kód klientovi sdělí advokát (telefonicky nebo osobně).
-- Spusť JEDNOU v Supabase SQL Editoru (po podpisy-a-aml.sql). Jde spustit i opakovaně.
alter table public.signature_otps add column if not exists channel text not null default 'sms' check (channel in ('sms', 'lawyer'));

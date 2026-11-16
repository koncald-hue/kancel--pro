-- Podpis s kódem na e-mail (bez placené SMS brány). Spusť JEDNOU v Supabase SQL Editoru po podpisy-a-aml.sql a podpisy-kod-od-advokata.sql.
alter table public.signature_requests add column if not exists signer_email text not null default '' check (char_length(signer_email) <= 160);
alter table public.signature_otps drop constraint if exists signature_otps_channel_check;
alter table public.signature_otps add constraint signature_otps_channel_check check (channel in ('sms', 'lawyer', 'email'));

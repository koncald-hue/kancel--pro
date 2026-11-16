-- =====================================================================
-- POŠTA V APLIKACI (připojení e-mailové schránky přes IMAP a SMTP)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné zruseni-a-zamek.sql.
-- Heslo ke schránce je uložené JEN zašifrované šifrovacím heslem advokáta (e1:), server ho nezná.
-- Zprávy se v databázi neukládají; uloží se jen to, co advokát výslovně uloží do věci.
-- =====================================================================
create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '' check (char_length(label) <= 120),
  email text not null check (char_length(email) <= 200),
  preset text not null default 'jiny' check (preset in ('gmail', 'seznam', 'centrum', 'jiny')),
  imap_host text not null check (char_length(imap_host) <= 200),
  imap_port integer not null default 993 check (imap_port in (993, 143, 465, 587)),
  smtp_host text not null check (char_length(smtp_host) <= 200),
  smtp_port integer not null default 465 check (smtp_port in (993, 143, 465, 587)),
  sent_folder text not null default '' check (char_length(sent_folder) <= 200),
  skip_append boolean not null default false,
  enc_password text not null check (enc_password like 'e1:%'),
  created_at timestamptz not null default now()
);
alter table public.mail_accounts enable row level security;
drop policy if exists "mail_accounts_own" on public.mail_accounts;
create policy "mail_accounts_own" on public.mail_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$
begin
  execute 'drop trigger if exists lock_when_expired on public.mail_accounts';
  execute 'create trigger lock_when_expired before insert or update or delete on public.mail_accounts for each row execute function public.block_when_locked()';
end $$;

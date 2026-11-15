-- =====================================================================
-- CHAT MEZI ČLENY KANCELÁŘE (end-to-end šifrovaný)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Nejdřív musí být spuštěné sdileni.sql (klíče členů, úložiště firm-shares).
--
-- Zpráva může být text, soubor, celá věc (spis), klient nebo nemovitost. Obsah zprávy je zašifrovaný v prohlížeči
-- odesílatele; server vidí jen příjemce, čas a velikost. Přílohy leží v úložišti také jen zašifrované.
-- Starší tabulka firm_shares (jednoduché sdílení souborů) už se nepoužívá a lze ji ponechat nebo smazat.
-- =====================================================================

create table if not exists public.firm_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text', 'file', 'case', 'client', 'property')),
  payload text not null check (char_length(payload) <= 3000000),
  wrapped_key_recipient text not null,
  wrapped_key_sender text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists firm_messages_recipient_idx on public.firm_messages (recipient_id, created_at desc);
create index if not exists firm_messages_sender_idx on public.firm_messages (sender_id, created_at desc);

create table if not exists public.firm_message_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.firm_messages(id) on delete cascade,
  path text not null unique,
  size bigint not null check (size >= 0 and size <= 52428800)
);
create index if not exists firm_message_files_message_idx on public.firm_message_files (message_id);

alter table public.firm_messages enable row level security;
alter table public.firm_message_files enable row level security;

drop policy if exists "firm_messages_read" on public.firm_messages;
create policy "firm_messages_read" on public.firm_messages for select using (auth.uid() in (sender_id, recipient_id));
drop policy if exists "firm_messages_insert" on public.firm_messages;
create policy "firm_messages_insert" on public.firm_messages for insert with check (
  sender_id = auth.uid() and recipient_id <> auth.uid() and public.same_firm(sender_id, recipient_id)
  and exists (select 1 from public.firm_members m where m.user_id = auth.uid() and m.firm_id = firm_messages.firm_id)
);
drop policy if exists "firm_messages_delete" on public.firm_messages;
create policy "firm_messages_delete" on public.firm_messages for delete using (auth.uid() in (sender_id, recipient_id));
grant select, insert, delete on public.firm_messages to authenticated;

drop policy if exists "firm_message_files_read" on public.firm_message_files;
create policy "firm_message_files_read" on public.firm_message_files for select using (exists (select 1 from public.firm_messages m where m.id = message_id and auth.uid() in (m.sender_id, m.recipient_id)));
drop policy if exists "firm_message_files_insert" on public.firm_message_files;
create policy "firm_message_files_insert" on public.firm_message_files for insert with check (exists (select 1 from public.firm_messages m where m.id = message_id and m.sender_id = auth.uid()) and (storage.foldername(path))[1] = auth.uid()::text);
grant select, insert on public.firm_message_files to authenticated;

-- Přílohy v úložišti: čtou a mažou je odesílatel a příjemce zprávy
drop policy if exists "firm-shares: prilohy zprav cetou" on storage.objects;
create policy "firm-shares: prilohy zprav cetou" on storage.objects for select to authenticated
  using (bucket_id = 'firm-shares' and exists (select 1 from public.firm_message_files f join public.firm_messages m on m.id = f.message_id where f.path = name and auth.uid() in (m.sender_id, m.recipient_id)));
drop policy if exists "firm-shares: prilohy zprav mazou" on storage.objects;
create policy "firm-shares: prilohy zprav mazou" on storage.objects for delete to authenticated
  using (bucket_id = 'firm-shares' and exists (select 1 from public.firm_message_files f join public.firm_messages m on m.id = f.message_id where f.path = name and auth.uid() in (m.sender_id, m.recipient_id)));

-- Přehled konverzací: s kým, kolik nepřečtených a kdy naposledy
create or replace function public.chat_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('peer', t.peer, 'unread', t.unread, 'last_at', t.last_at, 'last_kind', t.last_kind) order by t.last_at desc), '[]'::jsonb)
  from (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as peer,
           count(*) filter (where recipient_id = auth.uid() and read_at is null) as unread,
           max(created_at) as last_at,
           (array_agg(kind order by created_at desc))[1] as last_kind
    from public.firm_messages where auth.uid() in (sender_id, recipient_id) group by 1
  ) t;
$$;
revoke all on function public.chat_summary() from public;
grant execute on function public.chat_summary() to authenticated;

create or replace function public.mark_chat_read(p_peer uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.firm_messages set read_at = now() where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
$$;
revoke all on function public.mark_chat_read(uuid) from public;
grant execute on function public.mark_chat_read(uuid) to authenticated;

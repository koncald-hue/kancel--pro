-- =====================================================================
-- 20261117_02  KLIENTSKÝ ODKAZ: DRUHÝ FAKTOR (KÓD Z E-MAILU)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Předpoklady: client-portal.sql, client-identity.sql, 20261117_01 (tabulka schema_migrations).
--
-- Bez druhého faktoru stačí k otevření klientské stránky samotný odkaz (kdo ho má, vidí věc).
-- Advokát může u odkazu zapnout „kód z e-mailu“: klient pak na každém novém zařízení zadá
-- jednorázový kód poslaný na e-mail, který zadal ADVOKÁT (ne ten, kdo odkaz otevřel).
-- Existující odkazy se nemění (second_factor = 'none'), dokud to advokát nezapne.
-- =====================================================================

alter table public.client_links add column if not exists second_factor text not null default 'none';
alter table public.client_links drop constraint if exists client_links_second_factor_check;
alter table public.client_links add constraint client_links_second_factor_check check (second_factor in ('none', 'email'));
alter table public.client_links add column if not exists code_email text not null default '';
alter table public.client_links drop constraint if exists client_links_code_email_check;
alter table public.client_links add constraint client_links_code_email_check check (char_length(code_email) <= 160 and (code_email = '' or code_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
alter table public.client_links drop constraint if exists client_links_second_factor_email_check;
alter table public.client_links add constraint client_links_second_factor_email_check check (second_factor = 'none' or code_email <> '');

-- Kódy a relace klientů. Ukládají se jen otisky (HMAC/SHA-256), nikdy kód ani relace v čitelné podobě.
create table if not exists public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.client_links(id) on delete cascade,
  code_hash text check (code_hash is null or code_hash ~ '^[0-9a-f]{64}$'),
  code_expires_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  session_hash text unique check (session_hash is null or session_hash ~ '^[0-9a-f]{64}$'),
  session_expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists portal_sessions_link_idx on public.portal_sessions (link_id, created_at desc);
alter table public.portal_sessions enable row level security;
revoke all on public.portal_sessions from public, anon, authenticated;
grant all on public.portal_sessions to service_role;
-- Advokát (vlastník odkazu) smí relace jen spočítat a smazat (= odhlásit klienta ze všech zařízení)
grant select (id, link_id, verified_at, session_expires_at, created_at), delete on public.portal_sessions to authenticated;
drop policy if exists "portal_sessions_owner_select" on public.portal_sessions;
create policy "portal_sessions_owner_select" on public.portal_sessions for select to authenticated
  using (exists (select 1 from public.client_links l where l.id = link_id and l.user_id = auth.uid()));
drop policy if exists "portal_sessions_owner_delete" on public.portal_sessions;
create policy "portal_sessions_owner_delete" on public.portal_sessions for delete to authenticated
  using (exists (select 1 from public.client_links l where l.id = link_id and l.user_id = auth.uid()));

-- Při vypnutí druhého faktoru nebo změně e-mailu se dosavadní relace zruší
create or replace function public.reset_portal_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.second_factor is distinct from old.second_factor or new.code_email is distinct from old.code_email or new.token is distinct from old.token or (new.revoked and not old.revoked) then
    delete from public.portal_sessions where link_id = new.id;
  end if;
  return new;
end; $$;
revoke all on function public.reset_portal_sessions() from public, anon, authenticated;
drop trigger if exists reset_portal_sessions on public.client_links;
create trigger reset_portal_sessions after update on public.client_links
for each row execute function public.reset_portal_sessions();

insert into public.schema_migrations (name) values ('20261117_02_portal-kod-z-emailu') on conflict do nothing;

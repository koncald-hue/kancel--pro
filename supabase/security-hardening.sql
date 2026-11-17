-- Security hardening. Run after the existing schema files, before deploying the matching app code.
-- No existing case or signature data is altered or deleted.
create table if not exists public.api_rate_limits (
  key text primary key check (char_length(key) between 1 and 240),
  hit_count integer not null check (hit_count >= 0),
  reset_at timestamptz not null
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;
grant all on public.api_rate_limits to service_role;

create or replace function public.check_api_rate_limit(p_key text, p_limit integer, p_window_ms integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count integer; v_now timestamptz := clock_timestamp();
begin
  if p_key is null or char_length(p_key) not between 1 and 240
     or p_limit is null or p_limit < 1 or p_limit > 100000
     or p_window_ms is null or p_window_ms < 1000 or p_window_ms > 2678400000 then return true; end if;
  insert into public.api_rate_limits(key, hit_count, reset_at)
  values (p_key, 1, v_now + (p_window_ms::double precision / 1000) * interval '1 second')
  on conflict (key) do update set
    hit_count = case when public.api_rate_limits.reset_at <= v_now then 1 else public.api_rate_limits.hit_count + 1 end,
    reset_at = case when public.api_rate_limits.reset_at <= v_now then v_now + (p_window_ms::double precision / 1000) * interval '1 second' else public.api_rate_limits.reset_at end
  returning hit_count into v_count;
  if random() < 0.01 then delete from public.api_rate_limits where reset_at < v_now - interval '1 day'; end if;
  return v_count > p_limit;
end; $$;
revoke all on function public.check_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text, integer, integer) to service_role;

-- Prevent ownership transfer through the shared-editor UPDATE policy.
create or replace function public.guard_case_owner_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and new.user_id is distinct from old.user_id then
    raise exception 'Vlastníka věci nelze změnit běžnou úpravou.';
  end if;
  return new;
end; $$;
drop trigger if exists guard_case_owner_immutable on public.cases;
create trigger guard_case_owner_immutable before update on public.cases
for each row execute function public.guard_case_owner_immutable();

-- Preserve ownership and case association for rows within a case; content edits remain governed by RLS.
create or replace function public.guard_case_record_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (new.user_id is distinct from old.user_id or new.case_id is distinct from old.case_id) then
    raise exception 'Vlastníka ani přiřazení záznamu ke spisu nelze změnit běžnou úpravou.';
  end if;
  return new;
end; $$;
do $$
declare t text;
begin
  foreach t in array array['case_folders', 'case_files', 'case_entries', 'case_deadlines', 'case_contacts'] loop
    execute format('drop trigger if exists guard_case_record_identity on public.%I', t);
    execute format('create trigger guard_case_record_identity before update on public.%I for each row execute function public.guard_case_record_identity()', t);
  end loop;
end $$;

-- Keep OTP helpers inaccessible to browser roles.
alter table public.signature_otps add column if not exists channel text not null default 'sms';
alter table public.signature_otps drop constraint if exists signature_otps_channel_check;
alter table public.signature_otps add constraint signature_otps_channel_check check (channel in ('sms', 'lawyer', 'email'));

create or replace function public.issue_signature_otp(p_request uuid, p_code_hash text, p_expires_at timestamptz, p_channel text, p_max_sends integer)
returns text language plpgsql security definer set search_path = public as $$
declare r public.signature_requests%rowtype; v_count integer;
begin
  select * into r from public.signature_requests where id = p_request for update;
  if p_request is null or not found or r.status <> 'pending' or r.level <> 'advanced'
     or (r.expires_at is not null and r.expires_at <= now())
     or p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '30 minutes'
     or p_channel is null or p_channel not in ('sms', 'email', 'lawyer') then return 'invalid'; end if;
  select count(*) into v_count from public.signature_otps where request_id = p_request and created_at >= now() - interval '1 hour';
  if v_count >= greatest(1, least(coalesce(p_max_sends, 3), 10)) then return 'limit'; end if;
  insert into public.signature_otps(request_id, code_hash, expires_at, channel) values (p_request, p_code_hash, p_expires_at, p_channel);
  return 'ok';
end; $$;
revoke all on function public.issue_signature_otp(uuid, text, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.issue_signature_otp(uuid, text, timestamptz, text, integer) to service_role;

create or replace function public.consume_signature_otp(p_request uuid, p_otp uuid, p_code_hash text, p_max_attempts integer)
returns text language plpgsql security definer set search_path = public as $$
declare r public.signature_requests%rowtype; o public.signature_otps%rowtype;
begin
  select * into r from public.signature_requests where id = p_request for update;
  if p_request is null or p_otp is null or not found or r.status <> 'pending' or (r.expires_at is not null and r.expires_at <= now()) then return 'invalid'; end if;
  select * into o from public.signature_otps where id = p_otp and request_id = p_request for update;
  if not found or o.used or o.expires_at <= now() then return 'invalid'; end if;
  if o.attempts >= greatest(1, least(coalesce(p_max_attempts, 5), 10)) then return 'limit'; end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' or o.code_hash <> p_code_hash then
    update public.signature_otps set attempts = attempts + 1 where id = o.id;
    return 'mismatch';
  end if;
  update public.signature_otps set used = true where id = o.id;
  return 'ok';
end; $$;
revoke all on function public.consume_signature_otp(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_signature_otp(uuid, uuid, text, integer) to service_role;

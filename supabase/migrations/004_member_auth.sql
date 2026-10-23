-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004 — Member auth hardening
--
-- 1. current_member_id() now reads app_metadata. user_metadata is writable by
--    the signed-in user (auth.updateUser), so reading member_id from it let a
--    member impersonate any other member under RLS. app_metadata is
--    server-only (service role).
-- 2. PIN brute-force lockout (SECURITY.md §1): 5 wrong PINs → 15-minute
--    cooldown. Check + counter update happen in one row-locked function so
--    parallel guesses cannot bypass the limit.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')::uuid
$$;

alter table members
  add column pin_failed_attempts int not null default 0,
  add column pin_locked_until    timestamptz;

-- Returns the member id when the PIN hash matches and the member is not
-- locked out; otherwise NULL (callers must not distinguish the reasons).
create or replace function verify_member_pin(p_phone text, p_pin_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m members%rowtype;
begin
  select * into m from members where phone = p_phone for update;

  if not found or m.pin_hash is null then
    return null;
  end if;

  if m.pin_locked_until is not null and m.pin_locked_until > now() then
    return null;
  end if;

  if m.pin_hash = p_pin_hash then
    update members
       set pin_failed_attempts = 0, pin_locked_until = null
     where id = m.id;
    return m.id;
  end if;

  update members
     set pin_failed_attempts = case when m.pin_failed_attempts + 1 >= 5 then 0
                                    else m.pin_failed_attempts + 1 end,
         pin_locked_until    = case when m.pin_failed_attempts + 1 >= 5
                                    then now() + interval '15 minutes' end
   where id = m.id;
  return null;
end;
$$;

-- Only the server (service role) may verify PINs.
revoke all on function verify_member_pin(text, text) from public, anon, authenticated;
grant execute on function verify_member_pin(text, text) to service_role;

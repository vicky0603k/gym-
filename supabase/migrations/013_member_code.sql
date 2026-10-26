-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013 — Member IDs (e.g. FL-346587)
--
-- Owner decision (26 Oct 2026): every member gets a short ID so staff and the
-- member can recognise them at a glance (desk, check-in, member card).
--   members.member_code       unique random 6 digits, given on insert by the
--                             database (owner form, import script, seed — every
--                             path), never changed and never reused.
--   settings.member_id_prefix 2–4 capital letters shown in front ("FL").
--                             Null = the app uses the gym name's initials.
--                             Stored once in settings, not per member, so
--                             changing it updates every ID together.
-- The ID is a label only. QR check-in still needs the signed, rotating token.
-- No new table, so no new RLS policies; members_select_own (002) already
-- limits a member to their own row.
-- ═══════════════════════════════════════════════════════════════════════════

alter table settings
  add column member_id_prefix text check (member_id_prefix ~ '^[A-Z]{2,4}$');

alter table members add column member_code int;

-- Random unused code. The transaction lock makes two inserts at the same
-- moment take turns, so they can never pick the same number.
create or replace function next_member_code()
returns int
language plpgsql
volatile
set search_path = public
as $$
declare
  v int;
begin
  perform pg_advisory_xact_lock(hashtext('members.member_code'));
  loop
    v := 100000 + floor(random() * 900000)::int;
    exit when not exists (select 1 from members where member_code = v);
  end loop;
  return v;
end;
$$;

revoke all on function next_member_code() from public, anon, authenticated;
grant execute on function next_member_code() to service_role;

-- Give existing members an ID, oldest first. updated_at is left alone: the
-- member's details did not change.
alter table members disable trigger trg_members_updated_at;
do $$
declare
  r record;
begin
  for r in select id from members where member_code is null order by created_at, id loop
    update members set member_code = next_member_code() where id = r.id;
  end loop;
end;
$$;
alter table members enable trigger trg_members_updated_at;

alter table members
  alter column member_code set default next_member_code(),
  alter column member_code set not null,
  add constraint members_member_code_key unique (member_code),
  add constraint members_member_code_range check (member_code between 100000 and 999999);

-- Once given, an ID never changes.
create or replace function keep_member_code()
returns trigger
language plpgsql
as $$
begin
  if new.member_code is distinct from old.member_code then
    raise exception 'A member ID cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_members_keep_code
  before update of member_code on members
  for each row execute function keep_member_code();

-- The signed-in member (and staff via their session) may read the ID (005 §3).
grant select (member_code) on members to authenticated;

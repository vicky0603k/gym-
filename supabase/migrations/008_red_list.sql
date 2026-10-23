-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 008 — No-show Red List
--
-- Set-based, server-only functions (service_role):
--   member_absent_days()  one fair absence rule shared by the scan and the list
--   run_no_show_scan()    daily scan; idempotent via the one-open-case index
--   red_list()            open cases of eligible members, ready to display
--   record_followup()     append a follow-up + update its case in one transaction
--
-- Eligible = member Active AND current membership Active AND not past expiry.
-- Paused, Frozen, Expired, Cancelled (and Blocked) members never appear.
-- Follow-ups and cases are never deleted (005 made their FKs restrict).
-- ═══════════════════════════════════════════════════════════════════════════

-- Absence is counted from the latest of: last visit, joining, the end of the
-- last pause, or the last time staff closed a case for this member. So a new
-- member, a member back from a pause, or a closed case never turns red at once.
create or replace function member_absent_days(p_member_id uuid, p_today date)
returns int
language sql
stable
set search_path = public
as $$
  select p_today - greatest(
    (select (max(checkin_at) at time zone 'Asia/Kolkata')::date from attendance where member_id = p_member_id),
    (select join_date from members where id = p_member_id),
    (select max(freeze_end) from memberships where member_id = p_member_id),
    (select (max(resolved_at) at time zone 'Asia/Kolkata')::date from no_show_cases
      where member_id = p_member_id and status = 'Closed')
  );
$$;

-- Current membership per member = latest running/frozen/expired one (as check_in()).
create or replace view current_memberships as
  select distinct on (member_id) *
    from memberships
   where status in ('Active', 'Frozen', 'Expired')
   order by member_id, expiry_date desc;

-- Views run with the owner's rights; keep this one away from API roles.
revoke all on current_memberships from public, anon, authenticated;
grant select on current_memberships to service_role;

create or replace function run_no_show_scan()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today     date := (now() at time zone 'Asia/Kolkata')::date;
  v_threshold int;
  v_opened    int;
  v_due       int;
begin
  select coalesce((select no_show_threshold_days from settings limit 1), 10) into v_threshold;

  -- At most one open case per member: the partial unique index from 003 turns
  -- a second run (or a concurrent manual run) into a no-op.
  insert into no_show_cases (member_id, opened_on, absent_days_at_open, status)
  select m.id, v_today, a.days, 'Open'
    from members m
    join current_memberships c on c.member_id = m.id
    cross join lateral (select member_absent_days(m.id, v_today) as days) a
   where m.status = 'Active'
     and c.status = 'Active'
     and c.expiry_date >= v_today
     and a.days >= v_threshold
  on conflict (member_id) where status in ('Open', 'Contacted', 'FollowUpDue') do nothing;
  get diagnostics v_opened = row_count;

  -- Contacted cases whose next action date has arrived become due.
  update no_show_cases
     set status = 'FollowUpDue'
   where status = 'Contacted' and next_action_date <= v_today;
  get diagnostics v_due = row_count;

  return jsonb_build_object('ok', true, 'cases_opened', v_opened, 'followups_due', v_due, 'threshold', v_threshold);
end;
$$;

create or replace function red_list()
returns table (
  case_id               uuid,
  member_id             uuid,
  member_name           text,
  member_phone          text,
  case_status           case_status,
  opened_on             date,
  next_action_date      date,
  plan_name             text,
  expiry_date           date,
  join_date             date,
  last_visit            date,
  absent_days           int,
  trainer_name          text,
  last_followup_at      timestamptz,
  last_followup_outcome followup_outcome,
  last_followup_channel followup_channel,
  followup_count        int
)
language sql
stable
set search_path = public
as $$
  select
    nc.id, m.id, m.name, m.phone, nc.status, nc.opened_on, nc.next_action_date,
    p.name, c.expiry_date, m.join_date,
    (select (max(a.checkin_at) at time zone 'Asia/Kolkata')::date from attendance a where a.member_id = m.id),
    member_absent_days(m.id, (now() at time zone 'Asia/Kolkata')::date),
    t.name,
    f.created_at, f.outcome, f.channel,
    (select count(*)::int from followups x where x.case_id = nc.id)
  from no_show_cases nc
  join members m on m.id = nc.member_id
  join current_memberships c on c.member_id = m.id
  join plans p on p.id = c.plan_id
  left join trainers t on t.id = m.assigned_trainer_id
  left join lateral (
    select created_at, outcome, channel from followups
     where case_id = nc.id order by created_at desc limit 1
  ) f on true
  where nc.status in ('Open', 'Contacted', 'FollowUpDue')
    and m.status = 'Active'
    and c.status = 'Active'
    and c.expiry_date >= (now() at time zone 'Asia/Kolkata')::date
  order by 12 desc, m.name;
$$;

create or replace function record_followup(
  p_case_id          uuid,
  p_staff_id         uuid,
  p_channel          followup_channel,
  p_outcome          followup_outcome,
  p_notes            text,
  p_next_action_date date
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_case  no_show_cases%rowtype;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not exists (select 1 from staff_users where id = p_staff_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- Every outcome except "wants to cancel" needs a next step on or after today.
  if p_outcome <> 'Cancelled' and (p_next_action_date is null or p_next_action_date < v_today) then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  select * into v_case from no_show_cases where id = p_case_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_case.status not in ('Open', 'Contacted', 'FollowUpDue') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  insert into followups (case_id, channel, outcome, notes, staff_id, next_action_date)
  values (p_case_id, p_channel, p_outcome, nullif(btrim(p_notes), ''), p_staff_id,
          case when p_outcome = 'Cancelled' then null else p_next_action_date end);

  update no_show_cases
     set status = case
                    when p_outcome = 'Cancelled' then 'Closed'::case_status
                    when p_next_action_date <= v_today then 'FollowUpDue'::case_status
                    else 'Contacted'::case_status
                  end,
         next_action_date = case when p_outcome = 'Cancelled' then null else p_next_action_date end,
         resolved_at = case when p_outcome = 'Cancelled' then now() end,
         assigned_staff_id = coalesce(assigned_staff_id, p_staff_id)
   where id = p_case_id;

  return jsonb_build_object('ok', true, 'closed', p_outcome = 'Cancelled');
end;
$$;

revoke all on function member_absent_days(uuid, date) from public, anon, authenticated;
revoke all on function run_no_show_scan() from public, anon, authenticated;
revoke all on function red_list() from public, anon, authenticated;
revoke all on function record_followup(uuid, uuid, followup_channel, followup_outcome, text, date) from public, anon, authenticated;
grant execute on function member_absent_days(uuid, date) to service_role;
grant execute on function run_no_show_scan() to service_role;
grant execute on function red_list() to service_role;
grant execute on function record_followup(uuid, uuid, followup_channel, followup_outcome, text, date) to service_role;

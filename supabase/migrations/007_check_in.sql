-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 007 — Race-safe check-in
--
-- One function for QR and assisted check-in. A per-member advisory lock
-- serialises concurrent scans, so the duplicate-window check and the insert
-- can never interleave. Every early return happens before the first write.
--
-- The HMAC signature is verified on the server (src/services/qr.ts, the
-- secret never reaches the database); this function re-checks the verified
-- time step against the database clock inside the transaction.
--
-- Result: {ok:true, attendance_id, checkin_at, case_resolved, week_visits, weekly_target}
--      or {ok:false, code[, last_checkin_at][, expiry_date]}
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function check_in(
  p_member_id uuid,
  p_source    attendance_source,
  p_qr_step   bigint default null,
  p_staff_id  uuid   default null,
  p_reason    text   default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_member     members%rowtype;
  v_membership memberships%rowtype;
  v_today      date := (now() at time zone 'Asia/Kolkata')::date;
  -- 45 = QR_ROTATION_SECONDS. ±5 s absorbs app-server/database clock skew at a
  -- step boundary; the exact current/previous rule is enforced in qr.ts.
  v_step_min   bigint := floor((extract(epoch from now()) - 5) / 45) - 1;
  v_step_max   bigint := floor((extract(epoch from now()) + 5) / 45);
  v_window     int;
  v_last       timestamptz;
  v_attendance attendance%rowtype;
  v_resolved   int;
  v_week_start timestamptz;
  v_week_count int;
begin
  -- 1. Input / token checks (no lock needed yet)
  if p_source = 'QR' then
    -- Current step and one previous step only (QR_TOLERANCE_STEPS = 1).
    if p_qr_step is null or p_qr_step > v_step_max or p_qr_step < v_step_min then
      return jsonb_build_object('ok', false, 'code', 'QR_EXPIRED');
    end if;
  else
    if p_staff_id is null or not exists (select 1 from staff_users where id = p_staff_id) then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
    if coalesce(btrim(p_reason), '') = '' then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION');
    end if;
  end if;

  -- 2. Serialise every check-in for this member until commit.
  perform pg_advisory_xact_lock(hashtext('check_in:' || p_member_id::text));

  -- 3. Member status wins over the membership row.
  select * into v_member from members where id = p_member_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_member.status = 'Blocked' then
    return jsonb_build_object('ok', false, 'code', 'MEMBER_BLOCKED');
  end if;
  if v_member.status = 'Cancelled' then
    return jsonb_build_object('ok', false, 'code', 'MEMBER_CANCELLED');
  end if;

  -- 4. Current membership = latest running/frozen/expired one.
  select * into v_membership from memberships
   where member_id = p_member_id and status in ('Active', 'Frozen', 'Expired')
   order by expiry_date desc
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'MEMBERSHIP_EXPIRED', 'expiry_date', null);
  end if;
  if v_member.status = 'Paused' or v_membership.status = 'Frozen' then
    return jsonb_build_object('ok', false, 'code', 'MEMBERSHIP_PAUSED');
  end if;
  if v_member.status = 'Expired' or v_membership.status = 'Expired' or v_membership.expiry_date < v_today then
    return jsonb_build_object('ok', false, 'code', 'MEMBERSHIP_EXPIRED', 'expiry_date', v_membership.expiry_date);
  end if;

  -- 5. Duplicate window (settings.duplicate_window_hours, default 3).
  select coalesce((select duplicate_window_hours from settings limit 1), 3) into v_window;
  select max(checkin_at) into v_last from attendance
   where member_id = p_member_id and checkin_at > now() - make_interval(hours => v_window);
  if v_last is not null then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_CHECKIN', 'last_checkin_at', v_last);
  end if;

  -- 6. Writes.
  insert into attendance (member_id, checkin_at, source, qr_session_id, staff_id, correction_reason)
  values (
    p_member_id, now(), p_source,
    case when p_source = 'QR' then p_qr_step::text end,
    case when p_source = 'Assisted' then p_staff_id end,
    case when p_source = 'Assisted' then btrim(p_reason) end
  )
  returning * into v_attendance;

  update no_show_cases
     set status = 'Returned', resolved_at = now()
   where member_id = p_member_id and status in ('Open', 'Contacted', 'FollowUpDue');
  get diagnostics v_resolved = row_count;

  if p_source = 'Assisted' then
    insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
    values ('Staff', p_staff_id::text, 'attendance.assisted', 'attendance', v_attendance.id::text,
            format('Assisted check-in for %s. Reason: %s', v_member.name, btrim(p_reason)));
  end if;

  -- 7. Visits this Kolkata week (Monday 00:00 IST onwards; date_trunc weeks start Monday).
  v_week_start := date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  select count(*) into v_week_count from attendance
   where member_id = p_member_id and checkin_at >= v_week_start;

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_attendance.id,
    'checkin_at', v_attendance.checkin_at,
    'case_resolved', v_resolved > 0,
    'week_visits', v_week_count,
    'weekly_target', v_member.weekly_target
  );
end;
$$;

-- Only the server (service role) may run this.
revoke all on function check_in(uuid, attendance_source, bigint, uuid, text) from public, anon, authenticated;
grant execute on function check_in(uuid, attendance_source, bigint, uuid, text) to service_role;

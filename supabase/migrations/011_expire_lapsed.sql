-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 011 — Mark lapsed memberships and members Expired (daily cron)
--
-- Nothing moved a membership past its expiry date to Expired, so member
-- status drifted from reality (an "Active" member whose plan ended weeks ago).
-- Runs before the no-show scan each day. Frozen memberships and Paused,
-- Blocked or Cancelled members are left alone. verify_payment already turns
-- Expired back into Active when a renewal is confirmed.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function expire_lapsed_memberships()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'Asia/Kolkata')::date;
  v_memberships int;
  v_members     int;
begin
  update memberships set status = 'Expired'
   where status = 'Active' and expiry_date < v_today;
  get diagnostics v_memberships = row_count;

  -- Active member whose current membership is now Expired (and none running).
  update members m set status = 'Expired'
   where m.status = 'Active'
     and exists (select 1 from current_memberships c where c.member_id = m.id and c.status = 'Expired')
     and not exists (select 1 from memberships x where x.member_id = m.id and x.status in ('Active', 'Frozen'));
  get diagnostics v_members = row_count;

  if v_memberships > 0 or v_members > 0 then
    insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
    values ('System', 'cron', 'membership.expired', 'membership', v_today::text,
            format('%s memberships and %s members marked Expired (expiry before %s).', v_memberships, v_members, v_today));
  end if;

  return jsonb_build_object('ok', true, 'memberships_expired', v_memberships, 'members_expired', v_members);
end;
$$;

revoke all on function expire_lapsed_memberships() from public, anon, authenticated;
grant execute on function expire_lapsed_memberships() to service_role;

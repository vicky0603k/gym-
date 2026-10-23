-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005 — Hardening
--
-- 1. Staff can no longer write money/history tables directly with their own
--    session. All writes go through server services using the service role.
--    The separate *_select_own policies from 002 keep read access unchanged.
-- 2. audit_logs insert is service-role only (no forged audit rows).
-- 3. Sensitive members columns are hidden from anon/authenticated.
-- 4. Deleting a member no longer cascade-deletes financial or history rows.
-- 5. verify_payment / reject_payment: one transaction, row-locked, Owner-only.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 + 2. Drop direct write policies (names from 002_rls.sql) ────────────

drop policy "memberships_modify_staff"    on memberships;
drop policy "attendance_modify_staff"     on attendance;
drop policy "cases_modify_staff"          on no_show_cases;
drop policy "payments_modify_staff"       on payments;
drop policy "renewal_orders_modify_staff" on renewal_orders;
drop policy "addon_orders_modify_staff"   on addon_orders;
drop policy "notifications_modify_staff"  on notifications;
drop policy "audit_logs_insert_auth"      on audit_logs;

-- ─── 3. Column privileges on members ──────────────────────────────────────
-- 001–004 grant nothing explicitly; anon/authenticated hold Supabase's default
-- table-wide SELECT. A table-wide grant overrides column revokes, so replace it
-- with a column list. service_role keeps its grants. Callers using the user's
-- session must select explicit columns (select * will be refused).

revoke select on members from anon, authenticated;
grant select (
  id, name, phone, status, assigned_trainer_id, weekly_target,
  join_date, marketing_consent, created_at, updated_at
) on members to authenticated;

-- ─── 4. Member deletes must not erase history ─────────────────────────────
-- Constraint names are Postgres defaults (<table>_<column>_fkey): 001 declares
-- every reference inline without a name. Trainer set-null links are unchanged.

alter table memberships
  drop constraint memberships_member_id_fkey,
  add constraint memberships_member_id_fkey
    foreign key (member_id) references members(id) on delete restrict;

alter table attendance
  drop constraint attendance_member_id_fkey,
  add constraint attendance_member_id_fkey
    foreign key (member_id) references members(id) on delete restrict;

alter table no_show_cases
  drop constraint no_show_cases_member_id_fkey,
  add constraint no_show_cases_member_id_fkey
    foreign key (member_id) references members(id) on delete restrict;

alter table followups
  drop constraint followups_case_id_fkey,
  add constraint followups_case_id_fkey
    foreign key (case_id) references no_show_cases(id) on delete restrict;

alter table payments
  drop constraint payments_member_id_fkey,
  add constraint payments_member_id_fkey
    foreign key (member_id) references members(id) on delete restrict;

alter table renewal_orders
  drop constraint renewal_orders_membership_id_fkey,
  add constraint renewal_orders_membership_id_fkey
    foreign key (membership_id) references memberships(id) on delete restrict,
  drop constraint renewal_orders_payment_id_fkey,
  add constraint renewal_orders_payment_id_fkey
    foreign key (payment_id) references payments(id) on delete restrict;

alter table addon_orders
  drop constraint addon_orders_member_id_fkey,
  add constraint addon_orders_member_id_fkey
    foreign key (member_id) references members(id) on delete restrict,
  drop constraint addon_orders_payment_id_fkey,
  add constraint addon_orders_payment_id_fkey
    foreign key (payment_id) references payments(id) on delete restrict;

alter table notifications
  drop constraint notifications_member_id_fkey,
  add constraint notifications_member_id_fkey
    foreign key (member_id) references members(id) on delete restrict;

-- ─── 5. Payment verification ──────────────────────────────────────────────
-- Both functions return {ok:true,...} or {ok:false, code}. Every early return
-- happens before the first write; any exception rolls the whole call back.

create or replace function verify_payment(
  p_payment_id   uuid,
  p_provider_ref text,
  p_staff_id     uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_payment    payments%rowtype;
  v_order      renewal_orders%rowtype;
  v_membership memberships%rowtype;
  v_duration   int;
  v_new_expiry date;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and role = 'Owner') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if coalesce(btrim(p_provider_ref), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_payment.status = 'Paid' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_VERIFIED');
  end if;
  -- Add-on verification is not built yet; only renewals may transition.
  if v_payment.status <> 'Pending' or v_payment.purpose <> 'Renewal' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  select * into v_order from renewal_orders where payment_id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_order.status <> 'Pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  select * into v_membership from memberships where id = v_order.membership_id for update;
  if not found or v_membership.member_id <> v_payment.member_id then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  select duration_days into v_duration from plans where id = v_order.plan_id;

  v_new_expiry := greatest((now() at time zone 'Asia/Kolkata')::date, v_membership.expiry_date)
                  + v_duration;

  update payments
     set status = 'Paid', provider_ref = btrim(p_provider_ref),
         verified_by = p_staff_id, verified_at = now()
   where id = p_payment_id;

  update renewal_orders set status = 'Paid' where id = v_order.id;

  -- A frozen membership stays frozen; anything else becomes Active.
  update memberships
     set expiry_date = v_new_expiry,
         status = case when status = 'Frozen' then status else 'Active' end
   where id = v_membership.id;

  -- Only an Expired member is reactivated; Paused/Blocked/Cancelled stay as set.
  update members set status = 'Active'
   where id = v_payment.member_id and status = 'Expired';

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'payment.verified', 'payment', p_payment_id::text,
          format('Payment ₹%s verified. Membership extended to %s. Ref: %s',
                 v_payment.amount, v_new_expiry, btrim(p_provider_ref)));

  return jsonb_build_object('ok', true, 'new_expiry', v_new_expiry, 'payment_id', p_payment_id);
end;
$$;

create or replace function reject_payment(
  p_payment_id uuid,
  p_staff_id   uuid,
  p_reason     text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_payment payments%rowtype;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and role = 'Owner') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  -- Only Pending may fail; a Paid payment is never turned into Failed here.
  if v_payment.status <> 'Pending' or v_payment.purpose <> 'Renewal' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  update payments set status = 'Failed' where id = p_payment_id;

  update renewal_orders set status = 'Failed'
   where payment_id = p_payment_id and status = 'Pending';

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'payment.rejected', 'payment', p_payment_id::text,
          format('Payment ₹%s rejected. Reason: %s', v_payment.amount, btrim(p_reason)));

  return jsonb_build_object('ok', true);
end;
$$;

-- Only the server (service role) may run these.
revoke all on function verify_payment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function reject_payment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function verify_payment(uuid, text, uuid) to service_role;
grant execute on function reject_payment(uuid, uuid, text) to service_role;

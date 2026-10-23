-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 006 — verify_payment membership-state guard
--
-- 005 turned any non-Frozen membership Active on verification, so a Cancelled
-- or Pending membership could be revived by a payment. Those now return
-- INVALID_STATE before any write. Only Active, Expired and Frozen extend.
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- A Cancelled or Pending membership is never revived by a payment.
  if v_membership.status in ('Cancelled', 'Pending') then
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

-- create or replace keeps 005's grants; restated so this file stands alone.
revoke all on function verify_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function verify_payment(uuid, text, uuid) to service_role;

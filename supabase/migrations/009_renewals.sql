-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 009 — Renewal and manual UPI payment
--
-- 1. renewal_orders.new_expiry: the expiry a verified renewal produced, so a
--    receipt keeps showing the right date after later renewals (nullable,
--    set exactly once by verify_payment).
-- 2. verify_payment: as 006, plus the membership takes the renewed plan and
--    the order records new_expiry. Still one locked transaction, Owner only,
--    ALREADY_VERIFIED on a second call.
-- 3. create_renewal_order: order + Pending payment in one transaction under a
--    per-member lock; a double tap returns the same order. Nothing is deleted.
-- 4. claim_renewal_payment: the member records their UPI reference (UTR).
--    This never changes status — only verify_payment can make it Paid.
-- 5. renewals_due: the owner pipeline rows (expiring in 14 days or expired in
--    the last 30), excluding paused, cancelled and blocked members.
-- All functions: service_role only.
-- ═══════════════════════════════════════════════════════════════════════════

alter table renewal_orders add column new_expiry date;

-- ─── 2. verify_payment ───────────────────────────────────────────────────
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
  -- A Cancelled or Pending membership is never revived by a payment (006).
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

  update renewal_orders set status = 'Paid', new_expiry = v_new_expiry where id = v_order.id;

  -- A frozen membership stays frozen; anything else becomes Active. The plan
  -- becomes the one paid for (a Monthly member may renew on Yearly).
  update memberships
     set expiry_date = v_new_expiry,
         plan_id = v_order.plan_id,
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

revoke all on function verify_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function verify_payment(uuid, text, uuid) to service_role;

-- ─── 3. create_renewal_order ─────────────────────────────────────────────
create or replace function create_renewal_order(p_member_id uuid, p_plan_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_member     members%rowtype;
  v_membership memberships%rowtype;
  v_plan       plans%rowtype;
  v_pending    record;
  v_discount   int;
  v_order_id   uuid := gen_random_uuid();
  v_payment_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('renewal:' || p_member_id::text));

  select * into v_member from members where id = p_member_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_member.status in ('Blocked', 'Cancelled') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_membership from memberships
   where member_id = p_member_id and status in ('Active', 'Frozen', 'Expired')
   order by expiry_date desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_MEMBERSHIP');
  end if;

  select * into v_plan from plans where id = p_plan_id and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'PLAN_UNAVAILABLE');
  end if;

  -- At most one open renewal per member.
  select ro.id as order_id, ro.plan_id, p.id as payment_id, p.provider_ref
    into v_pending
    from renewal_orders ro
    join payments p on p.id = ro.payment_id
    join memberships ms on ms.id = ro.membership_id
   where ms.member_id = p_member_id and ro.status = 'Pending' and p.status = 'Pending'
   limit 1;
  if found then
    if v_pending.plan_id = p_plan_id then
      return jsonb_build_object('ok', true, 'existing', true, 'payment_id', v_pending.payment_id);
    end if;
    -- Switching plan is allowed only before the member says they have paid.
    if v_pending.provider_ref is not null then
      return jsonb_build_object('ok', false, 'code', 'PAYMENT_CLAIMED');
    end if;
    update renewal_orders set status = 'Cancelled' where id = v_pending.order_id;
    update payments set status = 'Failed' where id = v_pending.payment_id;
    insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
    values ('Member', p_member_id::text, 'renewal.replaced', 'payment', v_pending.payment_id::text,
            'Unpaid renewal replaced by the member choosing another plan.');
  end if;

  -- Same rounding as applyDiscount() in src/utils/money.ts (floor of the discount).
  v_discount := floor(v_plan.price * v_plan.discount_pct / 100.0);

  insert into payments (member_id, purpose, ref_id, amount, status)
  values (p_member_id, 'Renewal', v_order_id, v_plan.price - v_discount, 'Pending')
  returning id into v_payment_id;

  insert into renewal_orders (id, membership_id, plan_id, amount, discount, payment_id, status)
  values (v_order_id, v_membership.id, v_plan.id, v_plan.price, v_discount, v_payment_id, 'Pending');

  return jsonb_build_object('ok', true, 'existing', false, 'payment_id', v_payment_id);
end;
$$;

-- ─── 4. claim_renewal_payment ────────────────────────────────────────────
create or replace function claim_renewal_payment(p_payment_id uuid, p_member_id uuid, p_reference text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_payment payments%rowtype;
begin
  if coalesce(btrim(p_reference), '') !~ '^[A-Za-z0-9]{6,30}$' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  select * into v_payment from payments where id = p_payment_id and member_id = p_member_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_payment.status <> 'Pending' or v_payment.purpose <> 'Renewal' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;
  update payments set provider_ref = upper(btrim(p_reference)) where id = p_payment_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ─── 5. renewals_due ─────────────────────────────────────────────────────
create or replace function renewals_due()
returns table (
  member_id          uuid,
  member_name        text,
  member_phone       text,
  plan_name          text,
  renewal_amount     int,
  expiry_date        date,
  days_left          int,
  pending_payment_id uuid,
  pending_amount     int,
  pending_reference  text
)
language sql
stable
set search_path = public
as $$
  select
    m.id, m.name, m.phone, p.name,
    p.price - floor(p.price * p.discount_pct / 100.0)::int,
    c.expiry_date,
    c.expiry_date - (now() at time zone 'Asia/Kolkata')::date,
    pp.id, pp.amount, pp.provider_ref
  from members m
  join current_memberships c on c.member_id = m.id
  join plans p on p.id = c.plan_id
  left join lateral (
    select pay.id, pay.amount, pay.provider_ref
      from renewal_orders ro join payments pay on pay.id = ro.payment_id
     where ro.membership_id = c.id and ro.status = 'Pending' and pay.status = 'Pending'
     limit 1
  ) pp on true
  where m.status in ('Active', 'Expired')
    and c.status in ('Active', 'Expired')
    and c.expiry_date between (now() at time zone 'Asia/Kolkata')::date - 30
                          and (now() at time zone 'Asia/Kolkata')::date + 14
  order by c.expiry_date, m.name;
$$;

revoke all on function create_renewal_order(uuid, uuid) from public, anon, authenticated;
revoke all on function claim_renewal_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function renewals_due() from public, anon, authenticated;
grant execute on function create_renewal_order(uuid, uuid) to service_role;
grant execute on function claim_renewal_payment(uuid, uuid, text) to service_role;
grant execute on function renewals_due() to service_role;

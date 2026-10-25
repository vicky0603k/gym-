-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012 — Desk payments, refunds, freeze credit, staff access,
-- member status, attendance correction, PIN salt lookup, data-quality checks
--
-- Owner decisions (25 Oct 2026, GAPS.md):
--   A1  The desk takes Cash and UPI. Cash gets a generated receipt number
--       (CASH-000001…) as its reference. Every desk payment is still Pending
--       until verify_payment() — the only path that extends a membership.
--   A4  On a refund the owner chooses whether the membership extension is
--       taken back. The Paid row becomes Refunded; nothing is deleted.
--   C5  Days spent paused are added to the expiry on resume, capped by
--       settings.freeze_max_days_per_year over a rolling 365 days.
--
-- Schema (additive only):
--   payments.method          'UPI' | 'Cash'
--   settings.freeze_max_days_per_year, settings.gstin
--   staff_users.is_active    a removed staff member loses access at once
--   freeze_credits           one row per resume that added days (RLS below)
-- Functions (service_role only):
--   create_desk_renewal, refund_payment, resume_membership,
--   set_member_status, anonymise_member, backfill_attendance,
--   member_pin_salt, data_quality_issues
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Schema ──────────────────────────────────────────────────────────────
alter table payments
  add column method text not null default 'UPI' check (method in ('UPI', 'Cash'));

alter table settings
  add column freeze_max_days_per_year int not null default 30
    check (freeze_max_days_per_year between 0 and 365),
  add column gstin text;

alter table staff_users
  add column is_active boolean not null default true;

create sequence cash_receipt_seq;

create table freeze_credits (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete restrict,
  member_id     uuid not null references members(id) on delete restrict,
  days          int not null check (days > 0),
  credited_on   date not null,
  staff_id      uuid references staff_users(id),
  created_at    timestamptz not null default now()
);
create index idx_freeze_credits_member on freeze_credits (member_id, credited_on);

alter table freeze_credits enable row level security;
-- Written only by resume_membership() (service role). Staff read all, a member their own.
create policy "freeze_credits_select_own"
  on freeze_credits for select
  to authenticated
  using (member_id = current_member_id() or is_staff());

-- ─── Staff access follows is_active ──────────────────────────────────────
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff_users where id = auth.uid() and is_active);
$$;

create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff_users where id = auth.uid() and role = 'Owner' and is_active);
$$;

-- ─── create_desk_renewal (A1) ────────────────────────────────────────────
-- Staff record a payment taken at the counter. Creates the same renewal
-- order + Pending payment as create_renewal_order(), with the method and
-- reference filled in. The membership changes only when the owner verifies.
create or replace function create_desk_renewal(
  p_member_id uuid,
  p_plan_id   uuid,
  p_method    text,
  p_reference text,
  p_staff_id  uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today      date := (now() at time zone 'Asia/Kolkata')::date;
  v_member     members%rowtype;
  v_membership memberships%rowtype;
  v_plan       plans%rowtype;
  v_pending    record;
  v_reference  text;
  v_discount   int;
  v_order_id   uuid := gen_random_uuid();
  v_payment_id uuid;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and is_active) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if p_method = 'UPI' then
    if coalesce(btrim(p_reference), '') !~ '^[A-Za-z0-9]{6,30}$' then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION');
    end if;
    v_reference := upper(btrim(p_reference));
    if exists (select 1 from payments where provider_ref = v_reference and status in ('Pending', 'Paid')) then
      return jsonb_build_object('ok', false, 'code', 'DUPLICATE_REFERENCE');
    end if;
  elsif p_method <> 'Cash' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  perform pg_advisory_xact_lock(hashtext('renewal:' || p_member_id::text));

  select * into v_member from members where id = p_member_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_member.status in ('Blocked', 'Cancelled') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_plan from plans where id = p_plan_id and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'PLAN_UNAVAILABLE');
  end if;

  -- A renewal the member already says they paid must be verified, not replaced.
  select ro.id as order_id, p.id as payment_id, p.provider_ref
    into v_pending
    from renewal_orders ro
    join payments p on p.id = ro.payment_id
    join memberships ms on ms.id = ro.membership_id
   where ms.member_id = p_member_id and ro.status = 'Pending' and p.status = 'Pending'
   limit 1;
  if found then
    if v_pending.provider_ref is not null then
      return jsonb_build_object('ok', false, 'code', 'PAYMENT_CLAIMED', 'payment_id', v_pending.payment_id);
    end if;
    update renewal_orders set status = 'Cancelled' where id = v_pending.order_id;
    update payments set status = 'Failed' where id = v_pending.payment_id;
  end if;

  select * into v_membership from memberships
   where member_id = p_member_id and status in ('Active', 'Frozen', 'Expired')
   order by expiry_date desc limit 1;
  if not found then
    -- No membership to renew: open one that ended yesterday, so the member
    -- gets no access until the owner verifies; verify_payment() then runs
    -- it from today for the plan's duration.
    insert into memberships (member_id, plan_id, start_date, expiry_date, status, renewal_source)
    values (p_member_id, v_plan.id, v_today - 1, v_today - 1, 'Expired', 'Desk')
    returning * into v_membership;
  end if;

  if p_method = 'Cash' then
    v_reference := 'CASH-' || lpad(nextval('cash_receipt_seq')::text, 6, '0');
  end if;

  v_discount := floor(v_plan.price * v_plan.discount_pct / 100.0);

  insert into payments (member_id, purpose, ref_id, amount, status, method, provider_ref)
  values (p_member_id, 'Renewal', v_order_id, v_plan.price - v_discount, 'Pending', p_method, v_reference)
  returning id into v_payment_id;

  insert into renewal_orders (id, membership_id, plan_id, amount, discount, payment_id, status)
  values (v_order_id, v_membership.id, v_plan.id, v_plan.price, v_discount, v_payment_id, 'Pending');

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'payment.desk_recorded', 'payment', v_payment_id::text,
          format('%s payment of ₹%s for %s recorded at the desk. Ref: %s', p_method,
                 v_plan.price - v_discount, v_plan.name, v_reference));

  return jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'reference', v_reference,
                            'amount', v_plan.price - v_discount);
end;
$$;

-- ─── refund_payment (A4) ─────────────────────────────────────────────────
create or replace function refund_payment(
  p_payment_id uuid,
  p_staff_id   uuid,
  p_reason     text,
  p_reverse    boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today      date := (now() at time zone 'Asia/Kolkata')::date;
  v_payment    payments%rowtype;
  v_order      renewal_orders%rowtype;
  v_membership memberships%rowtype;
  v_duration   int;
  v_new_expiry date;
  v_note       text := '';
begin
  if not exists (select 1 from staff_users where id = p_staff_id and role = 'Owner' and is_active) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_payment.status = 'Refunded' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_REFUNDED');
  end if;
  if v_payment.status <> 'Paid' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  update payments set status = 'Refunded' where id = p_payment_id;

  if v_payment.purpose = 'AddOn' then
    -- PT sessions stop; a product already handed over is not restocked here.
    update addon_orders set status = 'Refunded'
     where payment_id = p_payment_id and status in ('Paid', 'Active', 'Completed');
    v_note := ' Add-on order refunded.';
  elsif p_reverse then
    select * into v_order from renewal_orders where payment_id = p_payment_id;
    select * into v_membership from memberships where id = v_order.membership_id for update;
    select duration_days into v_duration from plans where id = v_order.plan_id;
    v_new_expiry := v_membership.expiry_date - v_duration;
    -- verify_payment() extended from max(verify day, old expiry). Landing on or
    -- before the verify day means the member had already lapsed when they paid.
    if v_new_expiry <= (v_payment.verified_at at time zone 'Asia/Kolkata')::date then
      v_new_expiry := (v_payment.verified_at at time zone 'Asia/Kolkata')::date - 1;
    end if;
    v_new_expiry := greatest(v_membership.start_date, v_new_expiry);

    update memberships
       set expiry_date = v_new_expiry,
           status = case when status = 'Active' and v_new_expiry < v_today then 'Expired'::membership_status else status end
     where id = v_membership.id;
    if v_new_expiry < v_today then
      update members set status = 'Expired' where id = v_payment.member_id and status = 'Active';
    end if;
    v_note := format(' Extension taken back: expiry %s → %s.', v_membership.expiry_date, v_new_expiry);
  else
    v_note := ' Membership kept as it is.';
  end if;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'payment.refunded', 'payment', p_payment_id::text,
          format('Payment ₹%s refunded. Reason: %s.%s', v_payment.amount, btrim(p_reason), v_note));

  return jsonb_build_object('ok', true, 'new_expiry', v_new_expiry);
end;
$$;

-- ─── resume_membership (C5) ──────────────────────────────────────────────
-- Replaces the two-step resume in src/services/memberships.ts with one
-- transaction that also credits the paused days within the yearly cap.
create or replace function resume_membership(p_membership_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today      date := (now() at time zone 'Asia/Kolkata')::date;
  v_membership memberships%rowtype;
  v_max        int;
  v_used       int;
  v_credit     int;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and role = 'Owner' and is_active) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_membership from memberships where id = p_membership_id for update;
  if not found or v_membership.status <> 'Frozen' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  select coalesce(max(freeze_max_days_per_year), 0) into v_max from settings;
  select coalesce(sum(days), 0) into v_used from freeze_credits
   where member_id = v_membership.member_id and credited_on > v_today - 365;
  v_credit := greatest(0, least(v_today - coalesce(v_membership.freeze_start, v_today), v_max - v_used));

  update memberships
     set status = 'Active', freeze_end = v_today, expiry_date = expiry_date + v_credit
   where id = v_membership.id;
  update members set status = 'Active' where id = v_membership.member_id and status = 'Paused';

  if v_credit > 0 then
    insert into freeze_credits (membership_id, member_id, days, credited_on, staff_id)
    values (v_membership.id, v_membership.member_id, v_credit, v_today, p_staff_id);
  end if;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'membership.resumed', 'membership', v_membership.id::text,
          format('Membership resumed after %s paused days; %s days added (yearly cap %s, %s already used). Expiry %s → %s.',
                 v_today - coalesce(v_membership.freeze_start, v_today), v_credit, v_max, v_used,
                 v_membership.expiry_date, v_membership.expiry_date + v_credit));

  return jsonb_build_object('ok', true, 'days_added', v_credit, 'new_expiry', v_membership.expiry_date + v_credit);
end;
$$;

-- ─── set_member_status / anonymise_member (C2) ───────────────────────────
-- Cancelled = left the gym, Blocked = barred. Reactivate puts the member back
-- to the status their membership implies. History is never touched.
create or replace function set_member_status(p_member_id uuid, p_action text, p_reason text, p_staff_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_today   date := (now() at time zone 'Asia/Kolkata')::date;
  v_member  members%rowtype;
  v_current memberships%rowtype;
  v_status  member_status;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and role = 'Owner' and is_active) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if coalesce(btrim(p_reason), '') = '' or p_action not in ('Cancel', 'Block', 'Reactivate') then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  select * into v_member from members where id = p_member_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_action = 'Reactivate' then
    if v_member.status not in ('Cancelled', 'Blocked') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
    end if;
    select * into v_current from memberships
     where member_id = p_member_id and status in ('Active', 'Frozen', 'Expired')
     order by expiry_date desc limit 1;
    v_status := case
      when not found then 'Expired'
      when v_current.status = 'Frozen' then 'Paused'
      when v_current.status = 'Active' and v_current.expiry_date >= v_today then 'Active'
      else 'Expired' end;
  else
    if v_member.status in ('Cancelled', 'Blocked') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
    end if;
    v_status := case p_action when 'Cancel' then 'Cancelled' else 'Blocked' end;
  end if;

  update members set status = v_status where id = p_member_id;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'member.status_changed', 'member', p_member_id::text,
          format('Member %s: %s → %s. Reason: %s', v_member.name, v_member.status, v_status, btrim(p_reason)));

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- On request (SECURITY.md §6): remove name, phone and PIN of a member who has
-- left. Payments, attendance and audit rows stay for the gym's accounts.
create or replace function anonymise_member(p_member_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_member members%rowtype;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and role = 'Owner' and is_active) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select * into v_member from members where id = p_member_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_member.status <> 'Cancelled' or v_member.name = 'Former member' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  update members
     set name = 'Former member', phone = 'removed-' || p_member_id::text, pin_hash = null,
         notes = null, marketing_consent = false, notify_renewal = false, notify_care = false
   where id = p_member_id;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'member.anonymised', 'member', p_member_id::text,
          'Personal details removed on request; financial and attendance history kept.');
  return jsonb_build_object('ok', true);
end;
$$;

-- ─── backfill_attendance (C3) ────────────────────────────────────────────
-- Staff add a visit that happened while the app was down. Same duplicate
-- window as check_in(); a visit on or after an open case's date resolves it.
create or replace function backfill_attendance(p_member_id uuid, p_at timestamptz, p_reason text, p_staff_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_window int;
  v_id     uuid;
  v_case   uuid;
begin
  if not exists (select 1 from staff_users where id = p_staff_id and is_active) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if coalesce(btrim(p_reason), '') = '' or p_at is null or p_at > now() or p_at < now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  perform pg_advisory_xact_lock(hashtext('checkin:' || p_member_id::text));
  if not exists (select 1 from members where id = p_member_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select coalesce(max(duplicate_window_hours), 3) into v_window from settings;
  if exists (select 1 from attendance where member_id = p_member_id
              and checkin_at between p_at - make_interval(hours => v_window) and p_at + make_interval(hours => v_window)) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_CHECKIN');
  end if;

  insert into attendance (member_id, checkin_at, source, staff_id, correction_reason)
  values (p_member_id, p_at, 'Assisted', p_staff_id, btrim(p_reason))
  returning id into v_id;

  update no_show_cases
     set status = 'Returned', resolved_at = now()
   where member_id = p_member_id
     and status in ('Open', 'Contacted', 'FollowUpDue')
     and opened_on <= (p_at at time zone 'Asia/Kolkata')::date
  returning id into v_case;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'attendance.corrected', 'attendance', v_id::text,
          format('Missed visit added for %s. Reason: %s',
                 to_char(p_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH12:MI AM'), btrim(p_reason)));

  return jsonb_build_object('ok', true, 'attendance_id', v_id, 'case_resolved', v_case is not null);
end;
$$;

-- ─── member_pin_salt (C6) ────────────────────────────────────────────────
-- Returns the member's PIN salt so the server can compute the scrypt hash
-- that verify_member_pin() compares: '' for a legacy SHA-256 PIN, null when
-- the phone is unknown. Never reaches the browser.
create or replace function member_pin_salt(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when pin_hash like 'scrypt$%' then split_part(pin_hash, '$', 2) else '' end
    from members where phone = p_phone;
$$;

-- ─── data_quality_issues (C7) ────────────────────────────────────────────
create or replace function data_quality_issues()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'paid_without_reference', (select count(*) from payments where status = 'Paid' and coalesce(btrim(provider_ref), '') = ''),
    'active_past_expiry', (select count(*) from memberships
                            where status = 'Active' and expiry_date < (now() at time zone 'Asia/Kolkata')::date),
    'members_without_membership', (select count(*) from members m
                                    where m.status in ('Active', 'Paused', 'Expired')
                                      and not exists (select 1 from memberships x where x.member_id = m.id
                                                        and x.status in ('Active', 'Frozen', 'Expired'))),
    'payments_pending_over_3_days', (select count(*) from payments
                                      where status = 'Pending' and created_at < now() - interval '3 days'),
    'stock_below_zero', (select count(*) from addons where stock < 0)
  );
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────
revoke all on function create_desk_renewal(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function refund_payment(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function resume_membership(uuid, uuid) from public, anon, authenticated;
revoke all on function set_member_status(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function anonymise_member(uuid, uuid) from public, anon, authenticated;
revoke all on function backfill_attendance(uuid, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function member_pin_salt(text) from public, anon, authenticated;
revoke all on function data_quality_issues() from public, anon, authenticated;
revoke all on sequence cash_receipt_seq from public, anon, authenticated;
grant execute on function create_desk_renewal(uuid, uuid, text, text, uuid) to service_role;
grant execute on function refund_payment(uuid, uuid, text, boolean) to service_role;
grant execute on function resume_membership(uuid, uuid) to service_role;
grant execute on function set_member_status(uuid, text, text, uuid) to service_role;
grant execute on function anonymise_member(uuid, uuid) to service_role;
grant execute on function backfill_attendance(uuid, timestamptz, text, uuid) to service_role;
grant execute on function member_pin_salt(text) to service_role;
grant execute on function data_quality_issues() to service_role;
grant usage on sequence cash_receipt_seq to service_role;

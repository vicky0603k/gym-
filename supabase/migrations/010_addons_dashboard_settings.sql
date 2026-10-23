-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 010 — Add-ons, dashboard, gym profile and member preferences
--
-- Schema (additive only):
--   settings: opening_hours, maps_url, upi_id, upi_name, tagline (gym profile)
--   members:  notify_renewal, notify_care (member notification toggles;
--             marketing_consent already exists)
-- Functions (service_role only):
--   create_addon_order   order + Pending payment; reserves Product stock in the
--                        same transaction, so the last item can't be sold twice
--   cancel_payment       member drops an unpaid order (restores stock)
--   verify_payment       as 009, plus add-on payments (order Active/Completed)
--   reject_payment       Renewal or AddOn; restores reserved stock
--   claim_renewal_payment  now accepts add-on payments too (name kept)
--   record_pt_session    +1 only while sessions_used < sessions_total
--   adjust_stock         never below 0, reason required, audited
--   red_list / renewals_due  return the member's toggle; renewals_due reads
--                        the owner's renewal windows
--   dashboard_kpis       every DESIGN.md KPI from live data, one definition each
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Schema ──────────────────────────────────────────────────────────────
alter table settings
  add column opening_hours text,
  add column maps_url      text,
  add column upi_id        text,
  add column upi_name      text,
  add column tagline       text;

alter table members
  add column notify_renewal boolean not null default true,
  add column notify_care    boolean not null default true;

-- 005 replaced the table-wide grant with a column list; extend it.
grant select (notify_renewal, notify_care) on members to authenticated;

-- ─── create_addon_order ──────────────────────────────────────────────────
create or replace function create_addon_order(p_member_id uuid, p_addon_id uuid, p_quantity int)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_member     members%rowtype;
  v_addon      addons%rowtype;
  v_existing   uuid;
  v_order_id   uuid := gen_random_uuid();
  v_payment_id uuid;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  perform pg_advisory_xact_lock(hashtext('addon:' || p_member_id::text));

  select * into v_member from members where id = p_member_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_member.status in ('Blocked', 'Cancelled') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Row lock: concurrent buyers of the same product queue here.
  select * into v_addon from addons where id = p_addon_id and is_active for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_addon.type <> 'Product' and p_quantity <> 1 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  if v_addon.type = 'PT' and v_addon.trainer_id is not null
     and not exists (select 1 from trainers where id = v_addon.trainer_id and is_active) then
    return jsonb_build_object('ok', false, 'code', 'TRAINER_UNAVAILABLE');
  end if;

  -- A double tap returns the same unpaid order.
  select ao.payment_id into v_existing
    from addon_orders ao join payments p on p.id = ao.payment_id
   where ao.member_id = p_member_id and ao.addon_id = p_addon_id
     and ao.status = 'Pending' and p.status = 'Pending'
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'existing', true, 'payment_id', v_existing);
  end if;

  if v_addon.type = 'Product' then
    if coalesce(v_addon.stock, 0) < p_quantity then
      return jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK', 'stock', coalesce(v_addon.stock, 0));
    end if;
    -- Reserved now; given back if the payment is rejected or cancelled.
    update addons set stock = stock - p_quantity where id = v_addon.id;
  end if;

  insert into payments (member_id, purpose, ref_id, amount, status)
  values (p_member_id, 'AddOn', v_order_id, v_addon.price * p_quantity, 'Pending')
  returning id into v_payment_id;

  insert into addon_orders (id, member_id, addon_id, trainer_id, quantity, amount, payment_id,
                            sessions_total, sessions_used, status)
  values (v_order_id, p_member_id, v_addon.id, v_addon.trainer_id, p_quantity, v_addon.price * p_quantity,
          v_payment_id,
          case when v_addon.type = 'PT' then coalesce(v_addon.sessions, 1) end,
          case when v_addon.type = 'PT' then 0 end,
          'Pending');

  return jsonb_build_object('ok', true, 'existing', false, 'payment_id', v_payment_id);
end;
$$;

-- Shared by reject_payment and cancel_payment: close the order of a payment
-- that will never be Paid, and give back reserved product stock.
create or replace function release_unpaid_order(p_payment payments)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_order addon_orders%rowtype;
begin
  if p_payment.purpose = 'Renewal' then
    update renewal_orders set status = 'Failed' where payment_id = p_payment.id and status = 'Pending';
  else
    select * into v_order from addon_orders where payment_id = p_payment.id and status = 'Pending' for update;
    if found then
      update addon_orders set status = 'Cancelled' where id = v_order.id;
      update addons set stock = stock + v_order.quantity
       where id = v_order.addon_id and type = 'Product' and stock is not null;
    end if;
  end if;
end;
$$;

-- ─── cancel_payment (member, before they say they have paid) ─────────────
create or replace function cancel_payment(p_payment_id uuid, p_member_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_payment payments%rowtype;
begin
  select * into v_payment from payments where id = p_payment_id and member_id = p_member_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_payment.status <> 'Pending' or v_payment.provider_ref is not null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  update payments set status = 'Failed' where id = p_payment_id;
  perform release_unpaid_order(v_payment);
  if v_payment.purpose = 'Renewal' then
    update renewal_orders set status = 'Cancelled' where payment_id = p_payment_id;
  end if;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Member', p_member_id::text, 'payment.cancelled', 'payment', p_payment_id::text,
          format('Unpaid %s order of ₹%s cancelled by the member.', lower(v_payment.purpose::text), v_payment.amount));
  return jsonb_build_object('ok', true);
end;
$$;

-- ─── verify_payment (Renewal as 009, plus AddOn) ─────────────────────────
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
  v_addon_ord  addon_orders%rowtype;
  v_type       addon_type;
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
  if v_payment.status <> 'Pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  if v_payment.purpose = 'AddOn' then
    select * into v_addon_ord from addon_orders where payment_id = p_payment_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    end if;
    if v_addon_ord.status <> 'Pending' or v_addon_ord.member_id <> v_payment.member_id then
      return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
    end if;
    select type into v_type from addons where id = v_addon_ord.addon_id;

    update payments
       set status = 'Paid', provider_ref = btrim(p_provider_ref),
           verified_by = p_staff_id, verified_at = now()
     where id = p_payment_id;
    -- PT and diet plans start now; a product is handed over at the desk.
    update addon_orders
       set status = case when v_type = 'Product' then 'Completed'::addon_order_status else 'Active'::addon_order_status end
     where id = v_addon_ord.id;

    insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
    values ('Staff', p_staff_id::text, 'payment.verified', 'payment', p_payment_id::text,
            format('Add-on payment ₹%s verified. Ref: %s', v_payment.amount, btrim(p_provider_ref)));

    return jsonb_build_object('ok', true, 'new_expiry', null, 'payment_id', p_payment_id);
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

  update memberships
     set expiry_date = v_new_expiry,
         plan_id = v_order.plan_id,
         status = case when status = 'Frozen' then status else 'Active' end
   where id = v_membership.id;

  update members set status = 'Active'
   where id = v_payment.member_id and status = 'Expired';

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'payment.verified', 'payment', p_payment_id::text,
          format('Payment ₹%s verified. Membership extended to %s. Ref: %s',
                 v_payment.amount, v_new_expiry, btrim(p_provider_ref)));

  return jsonb_build_object('ok', true, 'new_expiry', v_new_expiry, 'payment_id', p_payment_id);
end;
$$;

-- ─── reject_payment (Renewal or AddOn) ───────────────────────────────────
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
  if v_payment.status <> 'Pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  update payments set status = 'Failed' where id = p_payment_id;
  perform release_unpaid_order(v_payment);

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'payment.rejected', 'payment', p_payment_id::text,
          format('Payment ₹%s rejected. Reason: %s', v_payment.amount, btrim(p_reason)));

  return jsonb_build_object('ok', true);
end;
$$;

-- ─── claim_renewal_payment: renewals and add-ons ─────────────────────────
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
  if v_payment.status <> 'Pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;
  update payments set provider_ref = upper(btrim(p_reference)) where id = p_payment_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ─── PT sessions and stock ───────────────────────────────────────────────
create or replace function record_pt_session(p_order_id uuid, p_staff_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order addon_orders%rowtype;
begin
  if not exists (select 1 from staff_users where id = p_staff_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- The guard is in the WHERE clause, so two quick taps can never pass the cap.
  update addon_orders
     set sessions_used = sessions_used + 1,
         status = case when sessions_used + 1 >= sessions_total
                       then 'Completed'::addon_order_status else 'Active'::addon_order_status end
   where id = p_order_id and status = 'Active'
     and sessions_total is not null and sessions_used < sessions_total
  returning * into v_order;

  if not found then
    select * into v_order from addon_orders where id = p_order_id;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    end if;
    if v_order.sessions_total is not null and v_order.sessions_used >= v_order.sessions_total then
      return jsonb_build_object('ok', false, 'code', 'ALL_USED', 'sessions_total', v_order.sessions_total);
    end if;
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE');
  end if;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'addon.pt_session', 'addon_order', p_order_id::text,
          format('PT session recorded. %s of %s used.', v_order.sessions_used, v_order.sessions_total));

  return jsonb_build_object('ok', true, 'sessions_used', v_order.sessions_used, 'sessions_total', v_order.sessions_total);
end;
$$;

create or replace function adjust_stock(p_addon_id uuid, p_delta int, p_reason text, p_staff_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_stock int;
  v_title text;
begin
  if not exists (select 1 from staff_users where id = p_staff_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000 or coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  update addons set stock = stock + p_delta
   where id = p_addon_id and type = 'Product' and stock is not null and stock + p_delta >= 0
  returning stock, title into v_stock, v_title;

  if not found then
    select stock into v_stock from addons where id = p_addon_id and type = 'Product';
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    end if;
    return jsonb_build_object('ok', false, 'code', 'NEGATIVE_STOCK', 'stock', coalesce(v_stock, 0));
  end if;

  insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
  values ('Staff', p_staff_id::text, 'addon.stock_adjusted', 'addon', p_addon_id::text,
          format('%s stock %s by %s (now %s). Reason: %s', v_title,
                 case when p_delta > 0 then 'increased' else 'reduced' end, abs(p_delta), v_stock, btrim(p_reason)));

  return jsonb_build_object('ok', true, 'stock', v_stock);
end;
$$;

-- ─── red_list / renewals_due with member toggles ─────────────────────────
-- Return types change, so these are dropped and recreated.
drop function red_list();
create function red_list()
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
  followup_count        int,
  notify_care           boolean
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
    (select count(*)::int from followups x where x.case_id = nc.id),
    m.notify_care
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

drop function renewals_due();
create function renewals_due()
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
  pending_reference  text,
  notify_renewal     boolean
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
    pp.id, pp.amount, pp.provider_ref,
    m.notify_renewal
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
    -- From the owner's earliest renewal window (default 14) to 30 days overdue.
    and c.expiry_date between (now() at time zone 'Asia/Kolkata')::date - 30
                          and (now() at time zone 'Asia/Kolkata')::date
                              + coalesce((select max(w) from settings, unnest(renewal_windows) w), 14)
  order by c.expiry_date, m.name;
$$;

-- ─── dashboard_kpis ──────────────────────────────────────────────────────
-- One definition per KPI; the screens they link to use the same functions.
create or replace function dashboard_kpis()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'Asia/Kolkata')::date;
  v_day_start   timestamptz := v_today::timestamp at time zone 'Asia/Kolkata';
  v_month_start timestamptz := date_trunc('month', v_today)::timestamp at time zone 'Asia/Kolkata';
begin
  return jsonb_build_object(
    -- Member Active with a running (Active, unexpired) membership.
    'active_members', (select count(*) from members m join current_memberships c on c.member_id = m.id
                        where m.status = 'Active' and c.status = 'Active' and c.expiry_date >= v_today),
    'checkins_today', (select count(*) from attendance where checkin_at >= v_day_start),
    -- Distinct members with a visit today or in the 6 days before.
    'active_7_days', (select count(distinct member_id) from attendance where checkin_at >= v_day_start - interval '6 days'),
    'red_list_open', (select count(*) from red_list()),
    'followups_due', (select count(*) from red_list() r
                       where r.case_status = 'FollowUpDue' or r.next_action_date <= v_today),
    -- Cases resolved as Returned this month that had at least one follow-up.
    'returned_this_month', (select count(*) from no_show_cases nc
                             where nc.status = 'Returned' and nc.resolved_at >= v_month_start
                               and exists (select 1 from followups f where f.case_id = nc.id)),
    'renewals_due_7_count', (select count(*) from renewals_due() r where r.days_left between 0 and 7),
    'renewals_due_7_amount', (select coalesce(sum(coalesce(r.pending_amount, r.renewal_amount)), 0)
                               from renewals_due() r where r.days_left between 0 and 7),
    'renewal_collection_month', (select coalesce(sum(amount), 0) from payments
                                  where purpose = 'Renewal' and status = 'Paid' and verified_at >= v_month_start),
    'addon_revenue_month', (select coalesce(sum(amount), 0) from payments
                             where purpose = 'AddOn' and status = 'Paid' and verified_at >= v_month_start),
    'cases_opened_today', (select count(*) from no_show_cases where opened_on = v_today),
    'renewals_paid_today_count', (select count(*) from payments
                                   where purpose = 'Renewal' and status = 'Paid' and verified_at >= v_day_start),
    'renewals_paid_today_amount', (select coalesce(sum(amount), 0) from payments
                                    where purpose = 'Renewal' and status = 'Paid' and verified_at >= v_day_start),
    'payments_pending', (select count(*) from payments where status = 'Pending')
  );
end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────
revoke all on function create_addon_order(uuid, uuid, int) from public, anon, authenticated;
revoke all on function release_unpaid_order(payments) from public, anon, authenticated;
revoke all on function cancel_payment(uuid, uuid) from public, anon, authenticated;
revoke all on function verify_payment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function reject_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function claim_renewal_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function record_pt_session(uuid, uuid) from public, anon, authenticated;
revoke all on function adjust_stock(uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function red_list() from public, anon, authenticated;
revoke all on function renewals_due() from public, anon, authenticated;
revoke all on function dashboard_kpis() from public, anon, authenticated;
grant execute on function create_addon_order(uuid, uuid, int) to service_role;
grant execute on function release_unpaid_order(payments) to service_role;
grant execute on function cancel_payment(uuid, uuid) to service_role;
grant execute on function verify_payment(uuid, text, uuid) to service_role;
grant execute on function reject_payment(uuid, uuid, text) to service_role;
grant execute on function claim_renewal_payment(uuid, uuid, text) to service_role;
grant execute on function record_pt_session(uuid, uuid) to service_role;
grant execute on function adjust_stock(uuid, int, text, uuid) to service_role;
grant execute on function red_list() to service_role;
grant execute on function renewals_due() to service_role;
grant execute on function dashboard_kpis() to service_role;

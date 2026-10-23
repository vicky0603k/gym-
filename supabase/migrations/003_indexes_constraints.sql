-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003 — Indexes and Constraints
--
-- All performance indexes, the partial unique index for one-open-case-per-
-- member, and the remaining check constraints.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Members ──────────────────────────────────────────────────────────────
-- phone is already unique from 001; add a normalised lookup index.
create index idx_members_phone          on members (phone);
create index idx_members_status         on members (status);
create index idx_members_trainer        on members (assigned_trainer_id);

-- ─── Memberships ──────────────────────────────────────────────────────────
-- Used by renewal pipeline queries (active memberships by expiry date).
create index idx_memberships_member_status on memberships (member_id, status);
create index idx_memberships_expiry        on memberships (expiry_date);
create index idx_memberships_status        on memberships (status);

-- ─── Attendance ───────────────────────────────────────────────────────────
-- The Red List scan and attendance history depend on this index.
create index idx_attendance_member_checkin on attendance (member_id, checkin_at desc);
create index idx_attendance_source         on attendance (source);

-- ─── No-show cases ────────────────────────────────────────────────────────
-- Partial unique index: at most ONE open case per member at any time.
-- Covers Open, Contacted and FollowUpDue (all "still open" states).
create unique index idx_no_show_cases_open_per_member
  on no_show_cases (member_id)
  where status in ('Open', 'Contacted', 'FollowUpDue');

-- Index for listing/filtering cases by status.
create index idx_no_show_cases_status   on no_show_cases (status);
create index idx_no_show_cases_next_action on no_show_cases (next_action_date)
  where next_action_date is not null;

-- ─── Followups ─────────────────────────────────────────────────────────────
-- Append-only history, queried by case + newest first.
create index idx_followups_case_created on followups (case_id, created_at desc);

-- ─── Payments ─────────────────────────────────────────────────────────────
-- Pending verification queue and member payment lookups.
create index idx_payments_status         on payments (status);
create index idx_payments_member         on payments (member_id);
create index idx_payments_purpose_status on payments (purpose, status);
create index idx_payments_verified_at   on payments (verified_at)
  where verified_at is not null;

-- ─── Renewal orders ───────────────────────────────────────────────────────
create index idx_renewal_orders_membership on renewal_orders (membership_id);
create index idx_renewal_orders_payment    on renewal_orders (payment_id);
create index idx_renewal_orders_status      on renewal_orders (status);

-- ─── Addon orders ────────────────────────────────────────────────────────
create index idx_addon_orders_member    on addon_orders (member_id);
create index idx_addon_orders_addon     on addon_orders (addon_id);
create index idx_addon_orders_status    on addon_orders (status);

-- ─── Notifications ────────────────────────────────────────────────────────
create index idx_notifications_member      on notifications (member_id);
create index idx_notifications_scheduled   on notifications (scheduled_at);

-- ─── Audit logs ────────────────────────────────────────────────────────────
create index idx_audit_logs_record   on audit_logs (record_type, record_id);
create index idx_audit_logs_action    on audit_logs (action);
create index idx_audit_logs_created   on audit_logs (created_at desc);

-- ─── Check constraints ────────────────────────────────────────────────────

-- addon_orders: sessions_used must be <= sessions_total (PT invariant).
alter table addon_orders
  add constraint chk_sessions_used_le_total
  check (
    sessions_total is null
    or sessions_used is null
    or sessions_used <= sessions_total
  );

-- addon_orders: sessions_used and sessions_total must be non-negative.
alter table addon_orders
  add constraint chk_sessions_non_negative
  check (
    (sessions_total is null or sessions_total >= 0)
    and (sessions_used is null or sessions_used >= 0)
  );

-- attendance: QR source should not require staff_id (only Assisted does).
-- Already enforced in 001 via chk_assisted_has_staff.

-- memberships: freeze_end must be after freeze_start when both set.
alter table memberships
  add constraint chk_freeze_dates
  check (
    freeze_start is null
    or freeze_end is null
    or freeze_end >= freeze_start
  );

-- memberships: expiry_date must be after start_date.
alter table memberships
  add constraint chk_expiry_after_start
  check (expiry_date >= start_date);

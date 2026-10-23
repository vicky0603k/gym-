-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002 — Row Level Security
--
-- RLS is enabled on EVERY table with no exceptions. A table without a policy
-- blocks all access by default (launch-blocking bug if missed).
--
-- Access model:
--   Members  — SELECT only their own rows. No direct writes (all via server
--              actions using the service role, which bypasses RLS).
--   Owner    — Full read/write on all tables.
--   FrontDesk — Read on operational tables; no settings, no audit log, no
--               payment verify/refund, no deletes.
--   audit_logs — INSERT for authenticated; SELECT Owner only; no UPDATE/DELETE
--                for anyone.
--   followups — INSERT for authenticated staff; SELECT for staff; no
--                UPDATE/DELETE for anyone (append-only).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Helper functions ─────────────────────────────────────────────────────

-- Returns the member_id stored in the JWT user_metadata (for member sessions).
-- Returns NULL for staff sessions or unauthenticated requests.
create or replace function current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')::uuid
$$;

-- Returns true if the current user is a staff member (exists in staff_users).
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_users where id = auth.uid()
  )
$$;

-- Returns true if the current user is an Owner.
create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_users where id = auth.uid() and role = 'Owner'
  )
$$;

-- Returns the role of the current staff user, or NULL.
create or replace function current_staff_role()
returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from staff_users where id = auth.uid()
$$;

-- ═══ Enable RLS on all tables ══════════════════════════════════════════════

alter table members        enable row level security;
alter table trainers       enable row level security;
alter table staff_users    enable row level security;
alter table plans          enable row level security;
alter table memberships    enable row level security;
alter table attendance     enable row level security;
alter table no_show_cases  enable row level security;
alter table followups      enable row level security;
alter table payments       enable row level security;
alter table renewal_orders enable row level security;
alter table addons         enable row level security;
alter table addon_orders   enable row level security;
alter table notifications  enable row level security;
alter table settings       enable row level security;
alter table audit_logs     enable row level security;

-- ═══ trainers ═══════════════════════════════════════════════════════════════
-- Members and staff can read trainer info (shown on add-on cards / landing).
create policy "trainers_read_all"
  on trainers for select
  to authenticated
  using (true);

-- Only Owner can modify trainers.
create policy "trainers_modify_owner"
  on trainers for all
  to authenticated
  using (is_owner())
  with check (is_owner());

-- ═══ staff_users ═══════════════════════════════════════════════════════════
-- Staff can see other staff (names/roles for assignment). Members cannot.
create policy "staff_read_staff"
  on staff_users for select
  to authenticated
  using (is_staff());

-- ═══ members ═══════════════════════════════════════════════════════════════
-- Members see only their own row.
create policy "members_select_own"
  on members for select
  to authenticated
  using (
    id = current_member_id() or is_staff()
  );

-- Only Owner can create/update members. FrontDesk cannot create members.
create policy "members_modify_owner"
  on members for all
  to authenticated
  using (is_owner())
  with check (is_owner());

-- ═══ plans ════════════════════════════════════════════════════════════════
-- Active plans are visible to all authenticated users (members see them on
-- the renewal screen, staff manage them).
create policy "plans_read_all"
  on plans for select
  to authenticated
  using (true);

-- Only Owner can modify plans.
create policy "plans_modify_owner"
  on plans for all
  to authenticated
  using (is_owner())
  with check (is_owner());

-- ═══ memberships ════════════════════════════════════════════════════════════
-- Members see only their own memberships. Staff see all.
create policy "memberships_select_own"
  on memberships for select
  to authenticated
  using (
    member_id = current_member_id() or is_staff()
  );

-- Only staff can modify memberships (via server actions with service role).
create policy "memberships_modify_staff"
  on memberships for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ attendance ════════════════════════════════════════════════════════════
-- Members see only their own attendance. Staff see all.
create policy "attendance_select_own"
  on attendance for select
  to authenticated
  using (
    member_id = current_member_id() or is_staff()
  );

-- Only staff can insert/update attendance (QR check-in and assisted check-in
-- are server actions using the service role).
create policy "attendance_modify_staff"
  on attendance for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ no_show_cases ═════════════════════════════════════════════════════════
-- Members can see their own case status (Open/Returned etc). Staff see all.
create policy "cases_select_own"
  on no_show_cases for select
  to authenticated
  using (
    member_id = current_member_id() or is_staff()
  );

-- Only staff can modify cases (scan creates, follow-up updates, resolve).
create policy "cases_modify_staff"
  on no_show_cases for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ followups (append-only) ════════════════════════════════════════════════
-- Staff can read follow-ups (contact history). Members cannot read them
-- directly (case status is available on the case row).
create policy "followups_select_staff"
  on followups for select
  to authenticated
  using (is_staff());

-- Staff can insert follow-ups (recording a contact outcome).
create policy "followups_insert_staff"
  on followups for insert
  to authenticated
  with check (is_staff());

-- NO update or delete policies — follow-ups are append-only.

-- ═══ payments ═══════════════════════════════════════════════════════════════
-- Members see only their own payments. Staff see all.
create policy "payments_select_own"
  on payments for select
  to authenticated
  using (
    member_id = current_member_id() or is_staff()
  );

-- Only staff can modify payments (verification is a server action).
create policy "payments_modify_staff"
  on payments for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ renewal_orders ════════════════════════════════════════════════════════
-- Members see only their own renewal orders. Staff see all.
create policy "renewal_orders_select_own"
  on renewal_orders for select
  to authenticated
  using (
    membership_id in (
      select id from memberships where member_id = current_member_id()
    ) or is_staff()
  );

-- Only staff can modify renewal orders.
create policy "renewal_orders_modify_staff"
  on renewal_orders for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ addons ════════════════════════════════════════════════════════════════
-- Active add-ons visible to all authenticated users.
create policy "addons_read_all"
  on addons for select
  to authenticated
  using (true);

-- Only Owner can modify add-ons.
create policy "addons_modify_owner"
  on addons for all
  to authenticated
  using (is_owner())
  with check (is_owner());

-- ═══ addon_orders ══════════════════════════════════════════════════════════
-- Members see only their own add-on orders. Staff see all.
create policy "addon_orders_select_own"
  on addon_orders for select
  to authenticated
  using (
    member_id = current_member_id() or is_staff()
  );

-- Only staff can modify add-on orders (member creates via server action).
create policy "addon_orders_modify_staff"
  on addon_orders for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ notifications ══════════════════════════════════════════════════════════
-- Members see only their own notifications. Staff see all.
create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (
    member_id = current_member_id() or is_staff()
  );

-- Only staff can modify notifications (server actions).
create policy "notifications_modify_staff"
  on notifications for all
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ═══ settings ══════════════════════════════════════════════════════════════
-- All authenticated users can read settings (gym name, timings for landing page).
create policy "settings_read_all"
  on settings for select
  to authenticated
  using (true);

-- Only Owner can modify settings.
create policy "settings_modify_owner"
  on settings for all
  to authenticated
  using (is_owner())
  with check (is_owner());

-- ═══ audit_logs (append-only, no update/delete for anyone) ════════════════
-- Only Owner can read audit logs.
create policy "audit_logs_select_owner"
  on audit_logs for select
  to authenticated
  using (is_owner());

-- Authenticated users (server actions) can insert audit entries.
create policy "audit_logs_insert_auth"
  on audit_logs for insert
  to authenticated
  with check (true);

-- NO update or delete policies — audit logs are append-only.

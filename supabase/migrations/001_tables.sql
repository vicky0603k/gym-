-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 001 — Tables
--
-- All tables for the Gym Retention PWA. No streaks table (computed on read).
-- Money is integer rupees. Timestamps are timestamptz (UTC stored, Kolkata
-- displayed). History tables (followups, audit_logs) are append-only.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ─── Enum types ───────────────────────────────────────────────────────────
create type member_status      as enum ('Active', 'Paused', 'Expired', 'Cancelled', 'Blocked');
create type membership_status   as enum ('Pending', 'Active', 'Frozen', 'Expired', 'Cancelled');
create type attendance_source    as enum ('QR', 'Assisted');
create type case_status          as enum ('Open', 'Contacted', 'FollowUpDue', 'Returned', 'Closed');
create type followup_channel     as enum ('Call', 'WhatsApp', 'InPerson');
create type followup_outcome    as enum ('WillReturn', 'Injured', 'Travelling', 'TimingIssue', 'Unhappy', 'NoResponse', 'Cancelled');
create type payment_purpose      as enum ('Renewal', 'AddOn');
create type payment_status       as enum ('Created', 'Pending', 'Paid', 'Failed', 'Refunded');
create type renewal_order_status as enum ('Pending', 'Paid', 'Failed', 'Cancelled');
create type addon_type           as enum ('PT', 'Diet', 'Product');
create type addon_order_status   as enum ('Pending', 'Paid', 'Active', 'Completed', 'Cancelled', 'Refunded');
create type notification_template as enum ('NoShowCare', 'RenewalReminder', 'PaymentSuccess', 'PaymentFailed', 'Streak', 'PTReminder');
create type notification_channel  as enum ('WhatsApp', 'Push', 'InApp');
create type notification_status   as enum ('Scheduled', 'Sent', 'Delivered', 'Failed', 'Clicked', 'Converted', 'OptedOut');
create type staff_role           as enum ('Owner', 'FrontDesk');

-- ─── updated_at trigger function (shared) ─────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══ trainers ═══════════════════════════════════════════════════════════════
create table trainers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  specialisation  text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_trainers_updated_at
  before update on trainers
  for each row execute function set_updated_at();

-- ═══ staff_users ═══════════════════════════════════════════════════════════
-- Linked 1:1 to Supabase Auth users (same id).
create table staff_users (
  id          uuid primary key,               -- matches auth.users.id
  name        text not null,
  role        staff_role not null default 'FrontDesk',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_staff_users_updated_at
  before update on staff_users
  for each row execute function set_updated_at();

-- ═══ members ════════════════════════════════════════════════════════════════
create table members (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text not null unique,    -- normalised 10-digit Indian mobile
  pin_hash            text,                    -- hashed 4-digit PIN (null until set)
  status              member_status not null default 'Active',
  assigned_trainer_id uuid references trainers(id) on delete set null,
  weekly_target       int not null default 4,
  join_date           date not null default current_date,
  marketing_consent   boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_members_updated_at
  before update on members
  for each row execute function set_updated_at();

-- ═══ plans ═════════════════════════════════════════════════════════════════
create table plans (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  duration_days int not null check (duration_days > 0),
  price         int not null check (price >= 0),
  discount_pct  int not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  benefits      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_plans_updated_at
  before update on plans
  for each row execute function set_updated_at();

-- ═══ memberships ════════════════════════════════════════════════════════════
create table memberships (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references members(id) on delete cascade,
  plan_id         uuid not null references plans(id),
  start_date      date not null,
  expiry_date     date not null,
  status          membership_status not null default 'Active',
  freeze_start    date,
  freeze_end      date,
  renewal_source  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_memberships_updated_at
  before update on memberships
  for each row execute function set_updated_at();

-- ═══ attendance ════════════════════════════════════════════════════════════
create table attendance (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references members(id) on delete cascade,
  checkin_at        timestamptz not null default now(),
  source            attendance_source not null,
  qr_session_id     text,                             -- token time-step ref for QR
  staff_id          uuid references staff_users(id),   -- required when source='Assisted'
  correction_reason text,                              -- required for corrections
  created_at        timestamptz not null default now()
);

-- Constraint: assisted check-ins must have a staff_id
alter table attendance
  add constraint chk_assisted_has_staff
  check (
    source <> 'Assisted' or staff_id is not null
  );

-- ═══ no_show_cases ═════════════════════════════════════════════════════════
-- One open case per member (partial unique index added in migration 003).
create table no_show_cases (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references members(id) on delete cascade,
  opened_on         date not null,
  absent_days_at_open int not null,
  status            case_status not null default 'Open',
  assigned_staff_id uuid references staff_users(id),
  next_action_date  date,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_no_show_cases_updated_at
  before update on no_show_cases
  for each row execute function set_updated_at();

-- ═══ followups (append-only — no update/delete policy in RLS) ══════════════
create table followups (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references no_show_cases(id) on delete cascade,
  channel          followup_channel not null,
  outcome          followup_outcome not null,
  notes            text,
  staff_id         uuid not null references staff_users(id),
  created_at       timestamptz not null default now(),
  next_action_date date
);

-- ═══ payments ═══════════════════════════════════════════════════════════════
create table payments (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members(id) on delete cascade,
  purpose       payment_purpose not null,
  ref_id        uuid not null,                  -- renewal_order or addon_order id
  provider_ref  text,                            -- UPI reference / later Razorpay id
  amount        int not null check (amount >= 0),
  status        payment_status not null default 'Created',
  verified_by   uuid references staff_users(id),
  verified_at   timestamptz,                     -- set exactly once on Pending→Paid
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function set_updated_at();

-- ═══ renewal_orders ═════════════════════════════════════════════════════════
create table renewal_orders (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  plan_id       uuid not null references plans(id),
  amount        int not null check (amount >= 0),
  discount      int not null default 0 check (discount >= 0),
  payment_id    uuid not null references payments(id) on delete cascade,
  status        renewal_order_status not null default 'Pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_renewal_orders_updated_at
  before update on renewal_orders
  for each row execute function set_updated_at();

-- ═══ addons ════════════════════════════════════════════════════════════════
create table addons (
  id            uuid primary key default gen_random_uuid(),
  type          addon_type not null,
  title         text not null,
  description   text,
  price         int not null check (price >= 0),
  validity_days int not null check (validity_days > 0),
  sessions      int check (sessions is null or sessions > 0),   -- PT only
  stock         int check (stock is null or stock >= 0),        -- Products only
  trainer_id    uuid references trainers(id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_addons_updated_at
  before update on addons
  for each row execute function set_updated_at();

-- ═══ addon_orders ══════════════════════════════════════════════════════════
create table addon_orders (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members(id) on delete cascade,
  addon_id       uuid not null references addons(id) on delete cascade,
  trainer_id     uuid references trainers(id) on delete set null,
  quantity       int not null default 1 check (quantity > 0),
  amount         int not null check (amount >= 0),
  payment_id     uuid not null references payments(id) on delete cascade,
  sessions_total int,
  sessions_used  int default 0,
  status         addon_order_status not null default 'Pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_addon_orders_updated_at
  before update on addon_orders
  for each row execute function set_updated_at();

-- ═══ notifications ══════════════════════════════════════════════════════════
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  template     notification_template not null,
  channel      notification_channel not null,
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  status       notification_status not null default 'Scheduled',
  created_at   timestamptz not null default now()
);

-- ═══ settings (single-row gym configuration) ══════════════════════════════
create table settings (
  id                     uuid primary key default gen_random_uuid(),
  gym_name               text not null default 'Gym',
  logo_url               text,
  address                text,
  phone                  text,
  timezone               text not null default 'Asia/Kolkata',
  no_show_threshold_days int not null default 10,
  qr_rotation_seconds    int not null default 45,
  duplicate_window_hours int not null default 3,
  renewal_windows        int[] not null default '{14,7,3,0,-3}',
  weekly_goal_default    int not null default 4,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

-- Enforce single row: lock the table to one row after the first insert
create or replace function enforce_single_row()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from settings) >= 1 then
    raise exception 'Only one settings row is allowed';
  end if;
  return new;
end;
$$;

create trigger trg_settings_single_row
  before insert on settings
  for each row execute function enforce_single_row();

-- ═══ audit_logs (append-only — no update/delete policy for any role) ══════
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_type  text not null,           -- 'Member' or 'Staff'
  actor_id    text not null,            -- uuid as text
  action      text not null,            -- e.g. 'attendance.assisted'
  record_type text not null,
  record_id   text not null,
  summary     text not null,
  created_at  timestamptz not null default now()
);

# DATABASE — Gym Retention PWA

PostgreSQL on Supabase. This file is the human-readable source of truth; the SQL that builds it lives in `supabase/migrations/`. Stack context: `TECH_STACK.md`. Flows that use these tables: `ARCHITECTURE.md`.

## Conventions

- Every table has `id uuid primary key default gen_random_uuid()` and `created_at timestamptz default now()`; mutable tables also have `updated_at`.
- All dates that members see (expiry, absent days) are **dates in Asia/Kolkata**, computed in the service layer — timestamps are stored in UTC (`timestamptz`) and converted on read/write.
- Money is stored as integer rupees (`amount int`), never floats.
- Enums are Postgres enums or `text` with check constraints; status values below are fixed — do not invent new ones without updating this file.
- **History is append-only:** attendance corrections, follow-ups, payment changes and audit rows are never deleted or overwritten; corrections are new rows.

## Tables

### members
The person. One row per gym member.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | Full name |
| phone | text UNIQUE | Login identity, 10-digit Indian mobile (store normalised, digits only) |
| pin_hash | text | Hashed 4-digit PIN, never plain text |
| status | enum | `Active, Paused, Expired, Cancelled, Blocked` |
| assigned_trainer_id | uuid FK → trainers | Nullable |
| weekly_target | int default 4 | Visits per week goal |
| join_date | date | |
| marketing_consent | boolean default false | Separate from service messages |
| notify_renewal | boolean default true | Member toggle: renewal reminder WhatsApps (migration 010) |
| notify_care | boolean default true | Member toggle: missed-visit (Red List) WhatsApps (migration 010) |
| notes | text | Owner-only |

### trainers
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name, phone | text | |
| specialisation | text | Shown on add-on cards where relevant |
| is_active | boolean default true | |

### staff_users
Owner and front-desk accounts, linked to Supabase Auth.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Same id as the Supabase Auth user |
| name | text | |
| role | enum | `Owner, FrontDesk` |

### plans
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. Monthly, Quarterly, Half-yearly, Yearly |
| duration_days | int | 30 / 90 / 180 / 365 as configured |
| price | int | Base price in ₹ |
| discount_pct | int default 0 | Final amount is computed and shown before payment |
| benefits | text | Bullet text shown on the renewal screen |
| is_active | boolean default true | Inactive plans are not offered |

### memberships
A member's subscription period. A member has many over time; at most one is Active.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| member_id | uuid FK → members | |
| plan_id | uuid FK → plans | |
| start_date | date | |
| expiry_date | date | The single most important date in the system — never null for an Active membership |
| status | enum | `Pending, Active, Frozen, Expired, Cancelled` |
| freeze_start, freeze_end | date | Nullable; set while Frozen |
| renewal_source | text | `Desk, App, Pilot import` etc. |

### attendance
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| member_id | uuid FK → members | |
| checkin_at | timestamptz | Exact moment, UTC stored, Kolkata displayed |
| source | enum | `QR, Assisted` |
| qr_session_id | text | Nullable; token time-step reference for QR entries |
| staff_id | uuid FK → staff_users | Required when source = Assisted |
| correction_reason | text | Required for any manual correction entry |

### streaks — NOT a table in the MVP (decided 23 Oct 2026)
Weekly-goal state is **computed on read** from `attendance` by `src/services/streak.ts` — current-week visits vs the member's `weekly_target`, plus consecutive goal-met weeks for the best-streak count. Do NOT create a `streaks` table in migration 001: at single-gym scale the indexed attendance queries are fast, and a cached table would add a sync-bug risk on every check-in. Revisit only if dashboard queries ever get slow.

### no_show_cases
One row per absence incident. **At most one open case per member at any time** (enforced by a partial unique index, see below).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| member_id | uuid FK → members | |
| opened_on | date | Day the threshold was crossed |
| absent_days_at_open | int | |
| status | enum | `Open, Contacted, FollowUpDue, Returned, Closed` |
| assigned_staff_id | uuid FK → staff_users | Who owns the follow-up |
| next_action_date | date | Nullable |
| resolved_at | timestamptz | Set when Returned/Closed |

### followups
Append-only contact history for a case.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK → no_show_cases | |
| channel | enum | `Call, WhatsApp, InPerson` |
| outcome | enum | `WillReturn, Injured, Travelling, TimingIssue, Unhappy, NoResponse, Cancelled` |
| notes | text | |
| staff_id | uuid FK → staff_users | Who made the contact |
| created_at | timestamptz | |
| next_action_date | date | Nullable |

### payments
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| member_id | uuid FK → members | |
| purpose | enum | `Renewal, AddOn` |
| ref_id | uuid | The renewal order or add-on order this pays for |
| provider_ref | text | UPI reference / later Razorpay id; a Paid payment without a reference triggers a data-quality alert |
| amount | int | ₹ actually paid |
| status | enum | `Created, Pending, Paid, Failed, Refunded` |
| verified_by | uuid FK → staff_users | MVP manual verification |
| verified_at | timestamptz | Set exactly once, on the Pending → Paid transition |

### renewal_orders
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| membership_id | uuid FK → memberships | Membership being renewed/extended |
| plan_id | uuid FK → plans | Plan chosen |
| amount | int | Base price at order time (snapshot) |
| discount | int | ₹ discount applied |
| payment_id | uuid FK → payments | |
| status | enum | `Pending, Paid, Failed, Cancelled` |
| new_expiry | date | Nullable; set once by `verify_payment` so the receipt keeps the expiry this renewal produced (migration 009) |

### addons
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| type | enum | `PT, Diet, Product` |
| title | text | |
| description | text | Outcome line, inclusions/exclusions, terms |
| price | int | ₹ |
| validity_days | int | |
| sessions | int | PT only; null otherwise |
| stock | int | Products only; null otherwise; never negative |
| trainer_id | uuid FK → trainers | Where a specific trainer is attached |
| is_active | boolean default true | |

### addon_orders
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| member_id, addon_id | uuid FKs | |
| trainer_id | uuid FK → trainers | Nullable |
| quantity | int default 1 | |
| amount | int | ₹ snapshot |
| payment_id | uuid FK → payments | |
| sessions_total, sessions_used | int | PT usage; invariant `sessions_used <= sessions_total` |
| status | enum | `Pending, Paid, Active, Completed, Cancelled, Refunded` |

### notifications
Reminder/message log (MVP: mostly the renewal and no-show reminder lists the staff act on; automated sending is Phase 2).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| member_id | uuid FK → members | |
| template | text | `NoShowCare, RenewalReminder, PaymentSuccess, PaymentFailed, Streak, PTReminder` |
| channel | enum | `WhatsApp, Push, InApp` |
| scheduled_at, sent_at | timestamptz | |
| status | enum | `Scheduled, Sent, Delivered, Failed, Clicked, Converted, OptedOut` |

### settings
Single-row gym configuration.
| Column | Type | Notes |
|---|---|---|
| gym_name, logo_url, address, phone | text | Public page + receipts |
| timezone | text default `Asia/Kolkata` | |
| no_show_threshold_days | int default 10 | Red List trigger |
| qr_rotation_seconds | int default 45 | |
| duplicate_window_hours | int default 3 | |
| renewal_windows | int[] default `{14,7,3,0,-3}` | Owner pipeline stages in days relative to expiry. The 14-day stage is an OWNER-ONLY heads-up/pipeline view — member reminder notifications fire only at `{7,3,0,-3}` (decided 23 Oct 2026) |
| weekly_goal_default | int default 4 | |
| tagline, opening_hours, maps_url | text | Gym profile shown on the landing page (migration 010) |
| upi_id, upi_name | text | Where members pay renewals and add-ons (migration 010; replaces the GYM_UPI_ID env var, kept as fallback) |

### audit_logs (append-only, no delete policy for anyone)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| actor_type, actor_id | text, uuid | Member / Staff + id |
| action | text | e.g. `attendance.assisted`, `payment.verified`, `membership.paused` |
| record_type, record_id | text, uuid | What was changed |
| summary | text | Human-readable before/after note |
| created_at | timestamptz | |

## Relationships (summary)

```
trainers 1─∞ members (assigned)
members 1─∞ memberships ∞─1 plans
members 1─∞ attendance
members 1─∞ no_show_cases 1─∞ followups
members 1─∞ payments
memberships 1─∞ renewal_orders ∞─1 payments
members 1─∞ addon_orders ∞─1 addons, ∞─1 payments
staff_users 1─∞ followups / attendance (assisted) / payments (verified_by)
```

## Indexes and constraints (migration 003)

- `members.phone` unique; lookup index on normalised phone.
- `memberships (member_id, status)` and `memberships (expiry_date)` — renewal pipeline queries.
- `attendance (member_id, checkin_at desc)` — last-visit and history queries; the Red List scan depends on this.
- Partial unique index: one open case per member —
  `unique (member_id) where status in ('Open','Contacted','FollowUpDue')` on `no_show_cases`.
- Check constraints: `addon_orders.sessions_used <= sessions_total`; `addons.stock >= 0` (products); `payments.amount >= 0`.
- Duplicate check-in protection is enforced in the service layer (time-window check within a transaction), backed by the attendance index.

## Row Level Security (migration 002 — see also SECURITY.md)

- **Members** can `select` only rows tied to their own `member_id` (their member record, memberships, attendance, cases status, orders, payments, notifications). Members cannot write financial or case data directly.
- **Owner** has full access.
- **FrontDesk** has access needed for daily work (members, attendance, follow-ups, payment verification queue) but cannot edit `settings` or delete anything.
- `audit_logs`: insert for authenticated server actions, select for Owner only, **no update/delete policy for any role**.
- All writes that change money or membership state go through server-side service functions, not direct client table writes.

## Seed data (supabase/seed.sql)

30 members with realistic Indian names and phones (status mix), 3 trainers, 1 owner + 1 front-desk login, 4 plans (Monthly ₹1,000 · Quarterly ₹2,500 · Half-yearly ₹4,500 · Yearly ₹8,000), attendance history that produces: 6 members absent 10–20 days (Red List), 5 memberships expiring within 7 days, 3 add-ons (PT 12 sessions ₹8,000 · Diet plan ₹1,999 · Whey protein ₹2,499 with stock). Seed PINs and passwords are documented inside the seed file and must never be used in production.

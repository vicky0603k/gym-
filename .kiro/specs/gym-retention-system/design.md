# Design — Gym Retention System

## Architecture
Next.js (App Router) on Vercel + Supabase (Postgres, Auth, RLS). Server Components + Server Actions for data; Client Components only for QR scanner, forms and install prompt. A daily cron route (`src/app/api/cron/daily`) runs the no-show scan and builds the renewal reminder lists. Business logic is isolated in `src/services/`: `qr.ts`, `red-list.ts`, `streak.ts`, `payments.ts`, `attendance.ts`, `auth.ts` (date helpers live in `src/utils/dates.ts`). There is NO `lib/` folder in this project — the root ARCHITECTURE.md and steering structure.md are binding on this point.

## Data model (Postgres)
- `members` — id, name, phone (unique), pin_hash, status [Active, Paused, Expired, Cancelled, Blocked], assigned_trainer_id, weekly_target (default 4), join_date, marketing_consent
- `trainers` — id, name, phone, specialisation
- `staff_users` — id (Supabase Auth), name, role [Owner, FrontDesk]
- `plans` — id, name, duration_days, price, discount_pct, benefits, is_active
- `memberships` — id, member_id, plan_id, start_date, expiry_date, status [Pending, Active, Frozen, Expired, Cancelled], renewal_source
- `attendance` — id, member_id, checkin_at, source [QR, Assisted], qr_session_id nullable, staff_id nullable, correction_reason nullable
- `no_show_cases` — id, member_id, opened_on, absent_days_at_open, status [Open, Contacted, FollowUpDue, Returned, Closed], UNIQUE open case per member (partial index on status != Returned/Closed)
- `followups` — id, case_id, channel [Call, WhatsApp, InPerson], outcome, notes, staff_id, created_at, next_action_date
- `payments` — id, member_id, purpose [Renewal, AddOn], ref_id, amount, status [Created, Pending, Paid, Failed, Refunded], verified_by, verified_at
- `renewal_orders` — id, membership_id, plan_id, amount, discount, payment_id, status
- `addons` — id, type [PT, Diet, Product], title, price, validity_days, sessions nullable, stock nullable, is_active
- `addon_orders` — id, member_id, addon_id, trainer_id nullable, qty, amount, payment_id, sessions_total, sessions_used, status [Pending, Paid, Active, Completed, Cancelled, Refunded]
- `notifications` — id, member_id, template, channel, scheduled_at, status [Scheduled, Sent, Delivered, Failed, Clicked, Converted, OptedOut]
- `settings` — gym profile, no_show_threshold_days (10), qr_rotation_seconds (45), duplicate_window_hours (3), renewal pipeline windows [14,7,3,0,-3] (the 14-day stage is an OWNER-ONLY pipeline/heads-up view — member reminder notifications fire only at [7,3,0,-3]), timezone (Asia/Kolkata)
- Weekly-goal/streak data is NOT a table: there is no `streaks` table in the MVP. It is computed on read from `attendance` by `src/services/streak.ts` (decided 23 Oct 2026 — single-gym scale makes a cache table an unnecessary sync risk).
- `audit_logs` — id, actor, action, record_type, record_id, summary, created_at (append-only)

## Key flows
**QR check-in:** Desk screen shows QR from `/api/qr-token` (HMAC of gym_id + floor(timestamp/45s), secret in env). Member scans → server verifies signature + window (±1 step) → checks membership Active → checks duplicate window → inserts attendance → updates weekly goal → resolves open no-show case if any → success screen.
**Daily scan (cron, gym morning):** For each Active membership: last valid attendance → absent days (Kolkata dates) → if ≥ threshold and no open case, insert case. Excludes Frozen/Paused via membership + member status.
**Renewal:** Member picks plan → renewal_order + payment (Pending) → pays via UPI outside app (MVP) → owner verifies in dashboard → `payments.verify()` transaction: set Paid once (guard: only from Pending), extend membership expiry (from max(today, current expiry)), generate receipt view, stop reminders.
**Weekly goal:** Count attendance in current Kolkata week (Mon–Sun) vs member.weekly_target; pauses stored on membership (freeze dates) exclude those days.

## Error / edge states (must be built, not skipped)
Invalid/expired QR · duplicate scan · expired membership at gate · paused member scans (allow check-in? No — show paused state) · wrong expiry data (owner edit with audit) · payment verified twice · refund reverses extension (new audit record, manual owner action in MVP) · add-on out of stock · trainer unavailable · notification opt-out · offline scan (NO offline queue in the MVP — the member sees the branded offline page and is directed to front-desk assisted check-in; an offline queue with audit sync is deferred to Phase 2, per ARCHITECTURE.md §5).

## Security
RLS on all tables; member role sees only own rows (matched by phone-auth member id); owner/staff via Supabase Auth roles. QR secret and Supabase service key server-only. No raw card/UPI credentials stored anywhere — ever.

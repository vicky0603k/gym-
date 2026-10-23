# ARCHITECTURE — Gym Retention PWA

How the system is put together. Scope is in `PRD.md`, stack rationale in `TECH_STACK.md`, tables in `DATABASE.md`, endpoints in `API.md`.

## 1. System overview

```
 Member phone (browser / installed PWA) ──┐
 Owner phone / desk tablet ────────────────┼──► Next.js app on Vercel
 Front-desk (same owner app, staff role) ──┘        │
                                                    ├── Server Components / Server Actions
                                                    ├── Route handlers: /api/qr-token, /api/cron/daily
                                                    └── Service layer (src/services)
                                                              │
                                                              ▼
                                                     Supabase (PostgreSQL + Auth + RLS)
                                                              │
                                                     Vercel Cron ──► /api/cron/daily (morning scan)
```

There is no separate backend service. Next.js is the application server; Supabase is the database and identity store; all business rules live in the service layer so that screens never contain logic.

## 2. Repository / folder architecture

```
src/
  app/            Next.js App Router — the pages layer
    (public)/     Landing page
    login/        Shared login entry
    member/       Member PWA (home, check-in, history, renew, add-ons, settings)
    owner/        Owner dashboard (dashboard, qr, red-list, members, renewals, add-ons, settings)
    api/          qr-token and cron route handlers only
    manifest.ts   PWA manifest
    sw.ts         Service worker (Serwist)
    offline/      Offline fallback page
  components/     UI only — no DB calls
    ui/           Primitives (button, input, card, dialog...)
    qr-scanner.tsx, qr-display.tsx, stat-card.tsx, member-row.tsx,
    outcome-dialog.tsx, install-prompt.tsx, states.tsx
  services/       All business logic and data access
    supabase/     client.ts (browser), server.ts (server), database.types.ts (generated)
    auth.ts       Role checks, current-user helpers
    qr.ts         Token sign/verify, rotation window
    attendance.ts Check-in (incl. assisted), history queries
    red-list.ts   Daily scan, case open/resolve, follow-up writes
    streak.ts     Weekly-goal calculation
    memberships.ts  Plans, membership lifecycle, pause/freeze
    payments.ts   Payment state machine + idempotent verification
    addons.ts     Catalogue, orders, PT usage, stock guards
    dashboard.ts  KPI queries
    notifications.ts  Reminder lists and message template rendering
  hooks/          useInstallPrompt, useQrScanner, useNow (clock for QR display)
  utils/          dates.ts (Asia/Kolkata helpers), money.ts (en-IN ₹), constants.ts
supabase/
  migrations/     Numbered SQL: 001 tables, 002 RLS policies, 003 indexes/constraints
  seed.sql        Demo data
tests/            Vitest unit tests + Playwright flows + failure-checklist runs
```

Rules: a component never imports the Supabase client directly (it calls a service or receives server-fetched props); a service never returns raw DB errors to the UI (it returns typed results); date math is only done through `utils/dates.ts`.

## 3. Key flows

### 3.1 QR check-in
1. Owner's QR display screen requests `GET /api/qr-token` and renders a QR containing a token: `HMAC(secret, gym_id + time_step)` where `time_step = floor(now / 45s)`. The screen refreshes every 45 seconds with a countdown.
2. Member scans → token posted to the check-in server action.
3. Server verifies the signature and accepts the current or previous time step (network tolerance), rejects anything older.
4. Server checks the member first (Blocked / Cancelled → refused), then the current membership: Expired → renewal error state; Paused/Frozen → paused state. Steps 4–6 run inside one `check_in()` transaction with a per-member advisory lock (migration 007).
5. Duplicate guard: if a valid check-in exists within 3 hours, return the duplicate state and write nothing.
6. Insert attendance (`source = QR`), recompute the weekly goal, and if the member has an open no-show case, resolve it as *Returned*.
7. Return the success state with the updated weekly goal.

### 3.2 Daily scan (cron)
`GET /api/cron/daily` (protected by `CRON_SECRET`, triggered by Vercel Cron at gym-local morning time):
1. For each Active membership, compute days since the last valid attendance in Asia/Kolkata dates.
2. Skip Paused / Frozen / Expired / Cancelled.
3. If absent days ≥ `settings.no_show_threshold_days` (default 10) and no open case exists, create one case.
4. Build the renewal reminder lists for the stages 14 / 7 / 3 / 0 / −3 days and the follow-ups-due list.
5. Idempotent by design: running the job twice in a day changes nothing the second time.

### 3.3 Renewal + payment verification (MVP, manual UPI)
1. Member picks a plan → a renewal order and a payment in `Pending` state are created; UPI instructions are shown.
2. Owner sees the payment in the Renewals → Pending verification queue and confirms receipt (or rejects).
3. Verification runs as one DB transaction in `services/payments.ts`: payment `Pending → Paid` (guarded — only from Pending), membership expiry extends from `max(today, current expiry)` + plan duration, receipt data is stored, reminders for that membership stop.
4. Because of the guard, verifying the same payment twice extends the membership exactly once. Failed/rejected payments never extend anything.

### 3.4 Red List follow-up
Owner opens Red List → rows are open cases ordered by absent days (desc) → Call (`tel:`) or WhatsApp (`wa.me` with rendered template) → Mark Outcome writes a `followups` row (outcome, staff, timestamp, next action date) and updates the case status → the member's next check-in resolves the case (flow 3.1, step 6). History rows are append-only.

### 3.5 Add-on purchase
Catalogue read → stock/availability check → order + Pending payment (same payment flow as 3.3) → on Paid: order becomes Active; PT usage increments are guarded (`sessions_used < sessions_total`); product stock decrements are guarded (never below 0).

## 4. Auth and roles

- Owner and front-desk: Supabase Auth email + password; role stored on the staff record.
- Member: phone + 4-digit PIN (hashed). The server resolves the phone to a member record and issues a session scoped to that member only.
- Middleware (`src/proxy.ts` or `middleware.ts` as generated) blocks unauthenticated access to `/member/*` and `/owner/*` and enforces role areas.
- Postgres RLS is the real boundary (see `DATABASE.md` / `SECURITY.md`): UI checks are convenience, RLS is enforcement.

## 5. PWA architecture

- `manifest.ts` provides name, icons, theme, `display: standalone`.
- Serwist service worker (`sw.ts`): precaches the app shell and static assets, runtime-caches read-only pages, and serves `/offline` when the network fails. **Attendance and payment writes are never queued silently offline in the MVP** — the member is told to use assisted check-in at the desk instead (an offline write queue with audit stamps is a Phase 2 candidate).
- Install prompt is shown contextually after the first successful check-in.

## 6. Environments

| Env | Where | Data |
|---|---|---|
| Local | `npm run dev` + Supabase cloud dev project (or local Supabase) | Seed data only |
| Production (pilot) | Vercel + one Supabase project | The pilot gym's real data |

One deployment serves one gym in the MVP. Multi-gym (tenancy) is a Phase 2 architecture change, recorded in `docs/decisions.md`.

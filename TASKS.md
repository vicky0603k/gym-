# TASKS — Gym Retention PWA

Build order for Kiro / any AI agent. **Work one module at a time, in this order.** A module is finished only when: the build passes (`npm run build`), the module's tests in `TESTING.md` pass, and the work is committed to git. Do not start the next module early, and do not build anything from the Phase 2 list.

Detail behind these tasks: `PRD.md` (scope), `DESIGN.md` (screens), `DATABASE.md` (tables), `API.md` (actions), `ARCHITECTURE.md` (flows).

## Module 1 — Project setup and data
- [ ] Scaffold Next.js (App Router, TypeScript strict, Tailwind) and the folder structure from `ARCHITECTURE.md`
- [ ] Add the PWA shell with Serwist: manifest, icons (placeholder is fine for now), offline page, install prompt component — the app must be installable before features are built on top
- [ ] Connect Supabase; write migrations: 001 tables, 002 RLS policies, 003 indexes and constraints (per `DATABASE.md`)
- [ ] Write `supabase/seed.sql` with the full demo dataset from `DATABASE.md` and load it
- [ ] Verify: build passes, tables and seed are visible in Supabase, app installs on an Android phone

## Module 2 — Auth, members and memberships
- [ ] Owner/front-desk login (email + password), member login (phone + PIN), role-based route protection
- [ ] Member home shell: current plan, exact expiry date, weekly-goal placeholder
- [ ] Owner Members: list, search by name/phone, add, edit, pause/resume with reason, membership history
- [ ] Plans: owner CRUD with price/discount, active flag
- [ ] Verify: role isolation test — a member session can never read another member's data (see `TESTING.md`)

## Module 3 — QR check-in and attendance
- [ ] `GET /api/qr-token` — rotating signed token (45s), owner QR display screen with countdown and auto-refresh
- [ ] Member scan flow (`html5-qrcode`): token verification, active-membership check, 3-hour duplicate guard, attendance write
- [ ] All check-in result states as full screens: success, duplicate, invalid QR, expired QR, expired membership (with Renew action), paused membership
- [ ] Staff assisted check-in: member search, mandatory reason, audit entry
- [ ] Attendance history: member view and owner view
- [ ] Verify: screenshot of a QR fails after the rotation window; duplicate scan writes nothing; assisted entry appears in the audit log

## Module 4 — Weekly goal / streak
- [ ] Weekly goal calculation in Asia/Kolkata weeks (Mon–Sun): visits vs `weekly_target`
- [ ] Home screen goal display (progress bar/ring, "3 of 4 visits this week"), best-week streak counter
- [ ] Pause/freeze days excluded from goal judgement; owner setting for the default target
- [ ] Verify: backdated attendance changes the count correctly; a frozen week does not show as a failed week

## Module 5 — Red List and follow-ups (core module)
- [ ] Scan service (`services/red-list.ts`): threshold from settings (default 10 days), exclusions for Paused/Frozen/Expired/Cancelled, one open case per member
- [ ] `GET /api/cron/daily` (secret-protected) + owner "Run scan now" button — both call the same idempotent service
- [ ] Red List screen: filters (10–14 / 15–21 / 22+ / expiring soon), rows with Call, WhatsApp (`wa.me` + template), Mark Outcome
- [ ] Outcome form: outcome enum, notes, next action date where required; follow-up history on the member detail screen
- [ ] Auto-resolve: a valid check-in by a red-listed member closes the case as Returned, history preserved
- [ ] Verify: a paused member never appears; a second scan creates no duplicate case; a return check-in resolves the case and the history is still visible

## Module 6 — Renewal and manual payment verification
- [ ] Member renewal screen: current plan/expiry, plan options with base price, discount and final payable, terms
- [ ] Order flow: renewal order + Pending payment, UPI instructions screen, pending state screen
- [ ] Owner: Renewals Due pipeline by stage (14/7/3/0/−3), Pending Verification queue
- [ ] `verifyPayment` transaction: Pending → Paid, membership extends from `max(today, current expiry)`, receipt generated, reminders stop; reject path marks Failed and extends nothing
- [ ] Receipt page (member + owner views)
- [ ] Verify: verifying the same payment twice extends exactly once; a failed payment extends nothing; the receipt shows the new expiry

## Module 7 — Add-ons
- [ ] Member catalogue: PT / Diet / Product cards with price, validity, sessions/stock, terms; detail sheet; nothing pre-selected
- [ ] Order flow reusing the Module 6 payment verification; stock and trainer-availability guards before order creation
- [ ] Owner: add-on CRUD, orders list, PT session usage recording (+1, capped), stock adjustment (never negative)
- [ ] Verify: out-of-stock purchase is blocked with a clear message; PT usage cannot exceed purchased sessions

## Module 8 — Dashboard, landing page and settings
- [ ] Owner dashboard: every KPI from `DESIGN.md` as a live query, each card linking to its action list; follow-ups due today; daily summary block
- [ ] Public landing page: gym info, photos, plans, trainers, timings, address, Login/Join entry
- [ ] Settings screen: gym profile, no-show threshold, renewal windows, weekly-goal default, staff accounts
- [ ] Member settings: notification toggles, marketing opt-out (effective immediately)
- [ ] Verify: dashboard numbers hand-checked against raw Supabase data on the seed dataset

## Module 9 — PWA polish and launch QA
- [ ] Final icons and splash/theme, install prompt shown after the first successful check-in, offline page copy
- [ ] 375px mobile pass on every screen; loading/empty/error state pass on every list
- [ ] Run the full failure checklist in `TESTING.md` and record pass/fail for each item
- [ ] Full pilot journey test: new member → check-ins → backdated absence → Red List → follow-up → return → renewal due → pay → verify → add-on purchase → PT session use
- [ ] Deploy to Vercel per `DEPLOYMENT.md` and repeat the smoke tests on the production URL

## Phase 2 — not now (only after the pilot proves usage)
- [ ] Razorpay integration with webhook-verified payments
- [ ] Automated WhatsApp API messages and push notifications
- [ ] Offline check-in queue with audit sync
- [ ] Trainer app, workout programming, body measurements
- [ ] Multi-gym tenancy, referral rewards, advanced reports

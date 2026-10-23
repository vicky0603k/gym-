# Phase Plan — Gym Retention PWA (AI Build Sequence)

This document defines how the project is cut into small phases so an AI coding agent (Kiro) can build it step by step. It complements `TASKS.md`: `TASKS.md` lists the work, this file controls **how the work is fed to the AI**.

## Rules — read before starting any phase

- **Rule 1 — One phase at a time.** A phase is complete only when: (a) the AI has finished its work, (b) `npm run build` passes, (c) the human has personally tested the phase's "Done criteria", and (d) the work is committed to Git. Do not start the next phase before all four are true, even if the AI offers to continue.
- **Rule 2 — Every phase prompt starts with this line:**
  > "Build ONLY Phase [number] from PHASE_PLAN.md. Do not build anything from later phases. When done, run the build, report what you tested, and stop."
- **Rule 3 — If a phase fails,** do not move forward and do not rebuild the phase from scratch. Use the failure prompt at the bottom of this file.

---

## Phase 1 — Project Setup Only
- **Scope:** Scaffold a new Next.js project inside this folder (TypeScript, App Router, `src/` directory, Tailwind CSS, ESLint) using create-next-app. Initialise Git with a first commit.
- **Out of scope:** No features, no database, no PWA yet. Do not modify or delete any documentation files (root `.md` files, `.kiro/`, `docs/`, `.env.example`, `.gitignore`).
- **Done criteria:** `npm run dev` serves the default page and `npm run build` passes.

## Phase 2 — PWA Shell Only
- **Scope:** Serwist service worker setup, PWA manifest, placeholder icons, offline page, and the "Add to Home Screen" install-prompt component.
- **Out of scope:** No business features.
- **Done criteria:** The site shows an install prompt / "Add to Home Screen" option in a mobile browser, and the branded offline page appears in airplane mode.

## Phase 3 — Database Only
- **Scope:** Write the three Supabase SQL files — `001` tables (no `streaks` table; weekly goals are computed, per ADR-010), `002` Row Level Security policies, `003` indexes and constraints, exactly as specified in `DATABASE.md`.
- **Out of scope:** No UI, no seed data yet.
- **Done criteria:** The three files are complete and every table, column, enum and constraint matches `DATABASE.md` on review.

## Phase 4 — Seed Data Only
- **Scope:** Write `supabase/seed.sql` with the full demo dataset from `DATABASE.md`: 30 members with realistic Indian names, 3 trainers, 1 owner and 1 front-desk login, 4 plans, 6 members absent 10–20 days, 5 memberships expiring within 7 days, and 3 add-ons.
- **Done criteria:** After running migrations + seed in Supabase, row counts in every table match the specification, checked by hand.

## Phase 5 — Authentication Only
- **Scope:** Owner/FrontDesk login (email + password via Supabase Auth), member login (phone + 4-digit PIN, hashed), and route protection: `/member/*` and `/owner/*` are unreachable without the correct role, and a member session can only ever access that member's own data.
- **Out of scope:** No member management screens yet — only login, logout and guarded placeholder pages.
- **Done criteria:** With two different member logins, neither can see the other's data. If this happens even once, the phase has FAILED — stop and fix before continuing.

## Phase 6 — Members and Plans (Owner)
- **Scope:** Owner Members screens (list, search by name/phone, add, edit, pause/resume with a mandatory reason, membership history) and Plans screens (create/edit plans, price, discount, active flag). The member home page shows the current plan and exact expiry date (weekly goal is still a placeholder).
- **Done criteria:** A newly added member can log in with their phone + PIN and sees the correct plan and expiry date.

## Phase 7 — QR Check-in (Complete Loop)
- **Scope:** `GET /api/qr-token` issuing HMAC-signed tokens rotating every 45 seconds; the owner QR display screen with countdown and auto-refresh; the member scan flow (`html5-qrcode`) with every result state — success, duplicate (within 3 hours), invalid QR, expired QR, expired membership (with a Renew action), paused membership; staff assisted check-in with a mandatory reason written to the audit log; attendance history for member and owner.
- **Done criteria:** A screenshot of the gate QR fails after the rotation window; a duplicate scan creates no second attendance row; an assisted check-in appears in the audit log.

## Phase 8 — Weekly Goal
- **Scope:** Compute visits in the current Asia/Kolkata week (Monday–Sunday) from the `attendance` table, in `src/services/streak.ts` — no new table. Member home shows the goal ("3 of 4 visits this week") and the best-week streak. Pause/freeze days never count against the member. Owner setting for the default weekly target.
- **Done criteria:** Inserting backdated attendance changes the goal count correctly, and a frozen/paused week is not shown as a failed week.

## Phase 9 — No-Show Red List (Complete Loop)
- **Scope:** The daily scan service in `src/services/red-list.ts` (threshold from settings, default 10 days; Paused/Frozen/Expired/Cancelled always excluded; one open case per member), exposed through the secret-protected cron route `GET /api/cron/daily` and an owner "Run scan now" button; the Red List screen with filters (10–14 / 15–21 / 22+ days, expiring soon) and Call, WhatsApp (`wa.me` link with the template from `API.md`) and Mark Outcome actions with a next action date; automatic case resolution (Returned) when the member checks in again, with follow-up history always preserved.
- **Done criteria:** A paused member never appears on the list; running the scan twice creates no duplicate case; a return check-in resolves the case as Returned and the follow-up history is still visible.

## Phase 10 — Renewal and Payment
- **Scope:** Member renewal screen (current plan and expiry, plan options with base price, discount and final payable amount, terms); renewal order + payment in `Pending` state with UPI payment instructions; owner Renewals Due pipeline by stage (14/7/3/0/−3 — the 14-day stage is owner-only, member reminders fire only at 7/3/0/+3, per ADR-009); the pending-verification queue; the `verifyPayment` transaction (payment `Pending → Paid` exactly once, membership extends from `max(today, current expiry)`, receipt generated); failed/rejected payments extend nothing; the receipt page.
- **Done criteria:** Verifying the same payment twice extends the membership **exactly once** — if this test fails, the project does not move forward. The receipt shows the new expiry date.

## Phase 11 — Add-ons, Dashboard, Landing Page and Settings
- **Scope, in this order inside the phase:**
  1. **Add-ons:** member catalogue (PT / Diet / Product) with price, validity, sessions/stock and terms, never pre-selected; order flow reusing the Phase 10 payment verification; stock and trainer-availability guards; owner screens for orders, PT session usage (+1, capped at the purchased total) and stock (never negative).
  2. **Owner dashboard:** every KPI from `DESIGN.md` as a live query (no cached or hardcoded numbers), each card linking to its action list, plus the daily summary and follow-ups due today.
  3. **Public landing page and settings:** gym landing page (photos, plans, trainers, timings, address, login entry); owner settings (gym profile, no-show threshold, renewal windows, weekly-goal default); member settings (notification toggles, marketing opt-out, effective immediately).
- **Done criteria:** An out-of-stock add-on cannot be purchased; dashboard numbers match hand-checked counts from the database.

## Phase 12 — Testing, Polish and Deployment
- **Scope:** Final PWA icons and theme/splash; a 375px mobile layout pass and a loading/empty/error state pass on every screen; run the complete 18-point failure checklist in `TESTING.md` and record pass/fail per item; run the full pilot journey end to end (new member → check-ins → backdated absence → Red List → follow-up → return → renewal due → pay → verify → add-on purchase); deploy to Vercel following `DEPLOYMENT.md` and repeat the smoke tests on the production URL.
- **Done criteria:** Every failure-checklist item passes, and on the production URL a real phone can log in and complete a test check-in.
- **After this phase, the product is ready for the 30-day pilot with a real gym.**

---

## Failure prompt (use when any phase goes wrong)

```
Stop adding features. Phase [number] has this problem: [what was expected,
what actually happened, paste the error message]. Find the root cause first
and explain it in 3 lines. Then fix only the files related to this problem.
Do not start the next phase. Run the build and show me the result.
```

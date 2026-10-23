# TESTING — Gym Retention PWA

How this project is verified. A module in `TASKS.md` is not done until its tests here pass. The seed dataset (`DATABASE.md`) exists specifically so every case below can be tested with known data.

## Test levels

1. **Unit tests (Vitest)** — pure logic in `src/services/` and `src/utils/`. These must exist and pass in CI/local before a module is marked done:
   - `dates`: expiry math, absent-days across month boundaries, week boundaries in Asia/Kolkata (including a check-in at 12:30 AM IST, which is still the previous day in UTC).
   - `streak`: weekly goal met / not met / frozen week excluded.
   - `red-list`: threshold crossing, exclusions, no second case for a member with an open case.
   - `payments`: verify transition only from Pending; second verify is a no-op; extension base is `max(today, current expiry)`.
   - `qr`: token valid in its step, accepted in the next step (tolerance), rejected two steps later; tampered token rejected.
2. **Integration tests** — server actions against a test Supabase project loaded with seed data: login isolation, check-in writes, scan job, verify-payment transaction.
3. **End-to-end (Playwright)** — the pilot journey, run on the seed data:
   login as member → check in → (backdate absence via seed/admin) → owner sees Red List → records a follow-up → member checks in → case resolved → renewal due → member pays (manual) → owner verifies → membership extended → buys an add-on → owner records a PT session.
4. **Manual device tests** — a real Android phone (Chrome) and, if available, an iPhone (Safari): PWA install, camera permission for scanning, WhatsApp deep links, layout at 375px.

## Per-module acceptance

Each module's own checks are listed at the end of its section in `TASKS.md` ("Verify: ..."). Those are part of testing, not optional extras.

## Mandatory failure checklist (run in full before the pilot — Module 9)

| # | Case | Expected result |
|---|---|---|
| 1 | Same member scans twice within minutes | Second scan shows the duplicate state; only one attendance row exists |
| 2 | Screenshot of the gate QR scanned 2 minutes later | Rejected as expired; no attendance written |
| 3 | Member with an Expired membership scans | Expired state with a Renew action; no attendance written |
| 4 | Paused/Frozen member | Never appears on the Red List; check-in shows the paused state |
| 5 | Daily scan (or Run scan) executed twice in one day | No duplicate cases, no duplicate reminders |
| 6 | Owner verifies the same Pending payment twice | Membership extends exactly once; second attempt returns ALREADY_VERIFIED |
| 7 | Payment marked Failed / rejected | Membership does not extend; member sees the failed state with retry/help |
| 8 | Refund of a Paid payment | Payment shows Refunded; the reversal is a new recorded adjustment with an audit entry — history is not silently rewritten |
| 9 | Wrong expiry date corrected by owner | Correction requires a reason and appears in the audit log |
| 10 | Buy an add-on with stock = 0 | Purchase blocked with a clear reason before any payment is created |
| 11 | Record a PT session beyond the purchased total | Blocked; usage stays at the cap |
| 12 | Trainer unavailable for a PT add-on | Purchase blocked with a clear reason |
| 13 | Member opts out of marketing messages | No marketing template is offered/sent to that member afterwards; service messages still work |
| 14 | Assisted check-in submitted without a reason | Rejected with a validation error |
| 15 | Member A tries to open Member B's history/receipt URLs or actions | Forbidden / not found — no data leaks (also verified directly against RLS) |
| 16 | Check-in attempted with no network | Branded offline page with the front-desk fallback instruction; no fake success state |
| 17 | Dashboard KPIs vs raw database counts on seed data | Every card matches a hand-run count |
| 18 | Renewal reminders after a successful renewal | No further reminder rows are created for the old expiry |

## Pilot UAT (with the real gym, before calling it launched)

- Front-desk staff member completes: a QR check-in, an assisted check-in, and a follow-up entry — without developer help.
- Owner completes: finding today's Red List, verifying a payment, reading the renewals-due total.
- One real member completes: install/open, check-in, viewing their renewal date.
- Any step that needs explanation twice is a design bug — log it in `docs/decisions.md` as a follow-up and fix before scaling.

## Reporting

Record the checklist result (date, environment, pass/fail per row, notes for failures) in `tests/failure-checklist-result.md` for each run. A failed row blocks the pilot launch until fixed and re-tested.

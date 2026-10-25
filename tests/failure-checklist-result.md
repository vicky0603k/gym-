# Failure checklist — results

**Run: 25 October 2026 · test Supabase project (`gym-retention`, Asia-Pacific) · production build (`next start`) · 375px Pixel 5 profile**

Every row of `TESTING.md` § Mandatory failure checklist, with where it is checked automatically. Re-run with:

```
npm test              # unit + database (PGlite, real migrations) — 260+ tests
npm run test:live     # real Supabase API, Auth and RLS (test project only)
npm run test:e2e      # Playwright pilot journey on a phone-sized screen
```

| # | Case | Result | Evidence |
|---|---|---|---|
| 1 | Same member scans twice within minutes | ✅ Pass | `tests/db/checkin-redlist.test.ts` (second scan → `DUPLICATE_CHECKIN`, one row); `tests/live/live.test.ts` (3 truly simultaneous calls → exactly one row) |
| 2 | Screenshot of the gate QR scanned 2 minutes later | ✅ Pass | `src/services/attendance.test.ts` "rejects an old token as expired" — refused before the database, nothing written |
| 3 | Expired member scans | ✅ Pass | `tests/db/checklist.test.ts` #3 (`MEMBERSHIP_EXPIRED`, no row); Renew button: `check-in-result.tsx` + unit tests |
| 4 | Paused/Frozen member | ✅ Pass | `tests/db/checklist.test.ts` #4 (`MEMBERSHIP_PAUSED`); never on the Red List: `tests/db/checkin-redlist.test.ts` |
| 5 | Daily scan run twice in one day | ✅ Pass | `tests/db/checkin-redlist.test.ts` "running the scan twice…" (no duplicate case) |
| 6 | Owner verifies the same Pending payment twice | ✅ Pass | `tests/db/payments.test.ts` (sequential) and `tests/live/live.test.ts` (two verifies at the same moment → extended once); e2e step "member renews by UPI" checks the receipt date |
| 7 | Payment rejected | ✅ Pass | `tests/db/payments.test.ts` (no extension, Failed, can't be verified later); member label "Not confirmed": `src/services/payments.test.ts` |
| 8 | Refund of a Paid payment | ✅ Pass | `tests/db/payments.test.ts` + e2e "front desk takes cash… owner refunds" (Refunded, audit row, days taken back; row kept) |
| 9 | Wrong expiry corrected by owner | ✅ Pass | `src/services/members.test.ts` correctExpiry (reason required, audit has old/new date); e2e "owner corrects the expiry" |
| 10 | Add-on with stock 0 | ✅ Pass | `tests/db/checklist.test.ts` #10 (`OUT_OF_STOCK`, no payment row created) |
| 11 | PT session beyond the purchased total | ✅ Pass | `tests/db/members-addons.test.ts` (`ALL_USED`, stays at the cap) |
| 12 | Trainer unavailable for a PT add-on | ✅ Pass | `tests/db/checklist.test.ts` #12 (`TRAINER_UNAVAILABLE`, no payment row) |
| 13 | Member opts out of marketing | ✅ Pass | The app sends no marketing messages at all (staff-tapped service messages only); opting out of missed-visit messages removes the WhatsApp button — e2e Red List step + `tests/db/checkin-redlist.test.ts` |
| 14 | Assisted check-in without a reason | ✅ Pass | `src/services/attendance.test.ts` "requires a reason before any database call" |
| 15 | Member A opens Member B's receipt/history | ✅ Pass | `tests/live/live.test.ts` (real RLS: rows, memberships, payments, PIN column, money functions); e2e "a member can't open another member's receipt" |
| 16 | Check-in attempted with no network | ✅ Pass | e2e "no network" (branded offline page with the front-desk instruction, no success state). Found and fixed: the offline page was never precached, so it could not appear in production |
| 17 | Dashboard KPIs vs raw counts | ✅ Pass | `tests/db/members-addons.test.ts` (active members, Red List, pending, 7-day distinct members vs hand counts) |
| 18 | Reminders after a successful renewal | ✅ Pass | `tests/db/checklist.test.ts` #18 (member leaves `renewals_due()` once renewed) |

## Not automated (needs real people or devices)

- Real Android Chrome: install prompt, camera permission on a real phone, WhatsApp links opening the app. The camera flow itself is automated with a fake camera feeding the live rotating QR.
- iPhone Safari: Add to Home Screen instructions.
- Pilot UAT with the gym's staff (TESTING.md § Pilot UAT).

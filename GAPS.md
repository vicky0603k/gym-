# GAPS — What is left before this goes to one gym

**Updated: 25 October 2026 · scope: one gym, one deployment, 30-day pilot then paid**

All code work in this file is done and tested. What remains needs an account, a device, a decision or material that only the owner or the gym can provide — listed in **Section B** and **Section D** with exactly what is needed.

## Where the project stands

- Phases 1–12 of `PHASE_PLAN.md` are built and tested against a real Supabase project (`gym-retention`, Asia-Pacific): migrations `001`–`012` and `seed.sql` applied.
- `npm run build`, `tsc --noEmit`, `next lint`: clean. `npm audit`: see D3.
- Tests: 260+ unit and database tests (`npm test`, database rules run on the real migrations in PGlite), 7 live tests on the real Supabase API and RLS (`npm run test:live`), 17-step Playwright pilot journey on a 375px phone screen with a real camera-QR check-in (`npm run test:e2e`). All 18 failure-checklist rows pass — `tests/failure-checklist-result.md`.

---

## A. Pilot blockers — all done

| # | Item | Status | Where |
|---|---|---|---|
| A1 | Front-desk renewal: **Cash + UPI** at the counter (owner decision 25 Oct) | ✅ Done | Member page → *Take payment*. Pending until the owner verifies in Renewals (same `verify_payment` path). Cash gets `CASH-000001`… receipts. Members with no membership can be started. |
| A2 | Staff PIN reset | ✅ Done | Member page → *Reset PIN* (owner + desk), clears lockout, audited |
| A3 | Correct an expiry date | ✅ Done | Member page → *Correct expiry* (owner, reason required, audited) |
| A4 | Refund a Paid payment — **owner chooses each time** whether days are taken back | ✅ Done | Receipt page → *Refund* (owner). Row becomes Refunded, never deleted; audited |
| A5 | Add to Home Screen prompt | ✅ Done | Shown once after the first successful check-in (Android Chrome install button, iPhone instructions) |
| A6 | The 33 empty integration tests | ✅ Done | `tests/db/*` (database rules), `tests/live/live.test.ts` (real RLS + true concurrency), `e2e/pilot.spec.ts` (screens). No `it.todo` left |
| A7 | Phase 12 — test and polish | ✅ Code done | Failure checklist, Playwright journey, 375px pass, `npm audit`, README. **Deploy and real-phone test need you — B1, B2** |
| A8 | Production database setup | ⏳ Needs you | Steps in `DEPLOYMENT.md` §2 — see B3 |

Bugs found and fixed while testing: offline page was never cached (no offline screen in production); weekly goal showed "On hold" after a same-day pause/resume; gym phone shown as "+91 +91…"; broken `manifest.json` link (PWA install); missing favicon; tab titles said "Gym Retention PWA" instead of the gym's name; refunded payments still showed "valid till"; bottom-nav labels wrapping at 375px; zoom was disabled (accessibility); placeholder "G" logo on the offline page.

## C. Before charging money — all done

| # | Item | Status | Where |
|---|---|---|---|
| C1 | Staff accounts screen | ✅ Done | Settings → *Staff logins*: add front desk, reset password, remove/restore access (audited) |
| C2 | Cancel / block / reactivate; anonymise on request | ✅ Done | Member page (owner). History kept |
| C3 | Attendance backfill | ✅ Done | Member page → *Add missed visit* (owner + desk, last 30 days, audited, resolves Red List) |
| C4 | Member import | ✅ Done | `node scripts/import-members.mjs members.csv` → dry run, then `--commit`; random PINs to `private/` |
| C5 | Freeze rules — **paused days added back, yearly cap in Settings** (owner decision 25 Oct) | ✅ Done | Settings → *Paused days added back per year* (default 30) |
| C6 | Stronger PIN storage | ✅ Done | Salted scrypt; old PINs upgrade on next login |
| C7 | Data-quality alerts | ✅ Done | Owner dashboard → *Records to check* (only when something needs attention) |
| C8 | GST on receipts | ✅ Done | Settings → GSTIN. Blank = plain receipt; set = tax invoice with 18% GST included |
| C9 | Privacy notice | ✅ Done (lawyer review: B6) | `/privacy`, linked from the website footer and login |
| C11 | Backups routine | ✅ Done | `npm run backup` weekly → `backups/<date>/` (git-ignored) |

---

## B. Needed from you or the gym (cannot be done in code)

| # | What | Why | What exactly I need |
|---|---|---|---|
| B1 | **Deploy to Vercel** | The app must be on the internet for phones | Create a Vercel account (free) and connect this GitHub repo, *or* run `npx vercel login` once in your own terminal. Then I set it up and run the `DEPLOYMENT.md` §4 smoke tests. Production env vars must use **new** `QR_TOKEN_SECRET` and `CRON_SECRET` (I'll give the command to generate them yourself). |
| B2 | **Real phone test** | Install prompt, real camera, WhatsApp links | 15 minutes with an Android phone (Chrome) on the deployed link; an iPhone too if you have one. I'll send a checklist. |
| B3 | **Production Supabase project** | Test and real data must be separate | A second Supabase project (same steps as before, Asia-Pacific). Run migrations `001`–`012` only — **never `seed.sql`**. Create the real owner login. |
| B4 | **Gym material** | The website and receipts show it | Logo (1024×1024) + 4–8 photos; trainer names/specialities with consent; final plans and prices in writing; UPI ID + payee name; GSTIN if registered; opening hours; Google Maps link. |
| B5 | **Member list** | For the import script | Excel/CSV: name, phone, plan, expiry date (and start date if known). |
| B6 | **Legal** | DPDP Act 2023, sales | A lawyer reads `/privacy` and the sales agreement (fees, pilot terms, data ownership, support hours, liability). |
| B7 | **Gate device** | The rotating QR at the entrance | A tablet or spare phone kept on the Owner → Check-in → Gate QR screen. |
| B8 | Answers to the open questions in `PRD.md` §11 and the pilot success number (`PRD.md` §9) | Agreed in writing before the pilot | A short call with the owner. |

## D. Decisions for you

| # | Decision | My recommendation |
|---|---|---|
| D1 | Custom domain (e.g. `app.<gymname>.in`) | Yes before charging — about ₹800/year; I configure it once B1 is done. |
| D2 | Replace test data on this test project | Keep it for testing. It now holds e2e test members (names start with "E2E", "Live Test", "Import Test") — harmless, never copied to production. |
| D3 | **Upgrade Next.js 14 → 15** | Recommended within the first month. Next 14.2.35 (now installed) fixes the critical issues for 14.x, and the unused image endpoint is switched off, but some advisories are fixed only in 15.5+. It is a framework upgrade (1–2 days, full retest with the suites above), so it needs your OK. zod 4 can go with it. |

## Not needed for one gym

Multi-gym tenancy, online payment gateway, automatic WhatsApp/SMS, offline check-in queue, trainer app, native apps, photo upload screen (`PRD.md` §4).

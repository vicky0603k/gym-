# Tasks — Gym Retention System (in order, one at a time)

## Module 1 — Setup & data
- [ ] Create Next.js (App Router, TS, Tailwind) project; add Serwist PWA shell (manifest, icons, install prompt) — app must be installable before features start
- [ ] Supabase project connect; write migrations for all tables in design.md with RLS policies
- [ ] Seed: 30 Indian members, 3 trainers, 1 owner + 1 front-desk login, 4 plans, 6 members absent 10–20 days, 5 memberships expiring in 7 days, 3 add-ons
- [ ] Verify: `npm run build` passes, seed visible in Supabase table editor

## Module 2 — Auth & profiles
- [ ] Owner/front-desk login (email + password); member login (phone + PIN)
- [ ] Member home shell: plan, expiry, weekly goal placeholder; owner can add/edit/pause members
- [ ] Verify: member cannot see another member's data (test with 2 logins)

## Module 3 — QR check-in
- [ ] `/api/qr-token` rotating signed QR + desk display page (auto-refresh)
- [ ] Member scan flow (html5-qrcode), all states: success, duplicate, invalid/expired QR, expired membership, paused
- [ ] Assisted check-in with staff + mandatory reason; attendance history (member + owner views)
- [ ] Verify: screenshot of QR fails after 45s; duplicate scan rejected; assisted entry shows in audit log

## Module 4 — Weekly goal / streak
- [ ] Weekly goal calculation (Kolkata week), home screen display, owner setting for default target
- [ ] Verify: rest days don't break it; a freeze/pause week doesn't count against member

## Module 5 — Red List & follow-ups
- [ ] Daily scan job (cron route + manual "Run scan" button for demo): creates cases per rules, no duplicates, exclusions applied
- [ ] Red List screen: filters (10–14 / 15–21 / 22+ / expiring soon), Call + WhatsApp (wa.me) + Mark Outcome with next action date
- [ ] Auto-resolve on return check-in; follow-up history view per member
- [ ] Verify: paused member never appears; same member gets only one open case; return closes case but history remains

## Module 6 — Renewal & manual payment
- [ ] Renewal screen (options, final amount, terms), Renewals Due pipeline for owner
- [ ] Payment flow: create Pending → owner verifies → membership extends exactly once → receipt page
- [ ] Verify: double-verify does not extend twice; failed payment does not extend; receipt shows new expiry

## Module 7 — Add-ons
- [ ] Catalogue (PT/Diet/Product) + order flow with stock/availability check, never pre-selected
- [ ] Owner: orders list, PT session usage (+1 per session), stock decrement, no negative values
- [ ] Verify: out-of-stock purchase blocked; usage cannot exceed package sessions

## Module 8 — Dashboard, landing page, settings
- [ ] Owner dashboard KPIs wired to real queries; daily summary list
- [ ] Public landing page (gym info, plans, trainers, timing, login entry)
- [ ] Settings screen (threshold, timings, gym profile); consent/opt-out toggles
- [ ] Verify: dashboard numbers hand-checked against raw seed data

## Module 9 — PWA polish & launch QA
- [ ] Final PWA icons/splash, install prompt after first successful check-in, offline page
- [ ] Mobile 375px pass on every screen; loading/empty/error state pass
- [ ] Final QA pass on the full failure checklist in TESTING.md
- [ ] Verify: full pilot journey — new member → check-ins → goes absent (backdate) → red list → follow-up → return → renewal due → pay → verify → add-on buy
- [ ] Deploy to Vercel per DEPLOYMENT.md and repeat smoke tests on the production URL

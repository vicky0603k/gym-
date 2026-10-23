# TECH STACK — Gym Retention PWA

Every technology used in this project, what it does, and why it was chosen. Do not substitute any item without recording the change in `docs/decisions.md`.

## Summary

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | One codebase gives the public website, the member app, the owner dashboard and API routes. Server components keep member pages fast on cheap phones. |
| Language | **TypeScript (strict)** | Catches data-shape mistakes (dates, payment states) at build time — critical when an AI agent writes most of the code. |
| Styling | **Tailwind CSS** | Utility classes, no separate CSS files to drift. Dark theme via design tokens. |
| UI components | **shadcn/ui** (as needed) | Accessible Button/Input/Dialog primitives copied into the repo — owned, not a heavy dependency. |
| Backend / DB | **Supabase (PostgreSQL)** | Database, auth, row-level security and storage in one free tier. No self-managed server for the pilot. |
| Auth | **Supabase Auth** (owner/staff) + **phone + PIN** (members, MVP) | Owners get real accounts. Members will not manage passwords; a phone number + 4-digit PIN matches how a local gym actually works. OTP is a later upgrade (it costs money per SMS). |
| PWA | **Serwist (`@serwist/next`)** | Service worker, offline page, caching — makes the website installable and app-like. |
| QR — generate | **`qrcode`** | Renders the rotating gate QR on the owner's display screen. |
| QR — scan | **`html5-qrcode`** | Camera scanning inside the phone browser; no native app needed. |
| Forms / validation | **React Hook Form + Zod** | Every form and server input is schema-validated (phone format, amounts, dates). |
| Dates | **`date-fns` + `date-fns-tz`** | All business dates computed in `Asia/Kolkata`. Native `Date` alone is a known bug source for expiry/absence math. |
| Hosting | **Vercel** | Zero-config Next.js hosting, free tier is enough for the pilot, provides cron triggers (`vercel.json`) for the daily scan. |
| Payments (MVP) | **Manual UPI + owner verification** | Zero integration cost to prove the renewal loop. Payment states are designed gateway-ready. |
| Payments (Phase 1.5) | **Razorpay** | Best UPI support for Indian gyms; membership extends only on a verified webhook. |
| Messaging | **`wa.me` deep links** (MVP) | Free. Staff tap WhatsApp on a Red List row and a prefilled message opens in their own WhatsApp. Bulk/template API is a paid later add-on. |
| Testing | **Vitest** (unit) + **Playwright** (key flows) | Unit tests for dates, streak, red-list and payment logic; Playwright for login → check-in → red-list journey. See `TESTING.md`. |
| Version control | **Git + GitHub** | Commit after every module in `TASKS.md`. Never commit `.env.local`. |

## Runtime / tooling

- Node.js LTS (20+), npm.
- ESLint + Prettier with the Next.js defaults.
- Supabase CLI for generating TypeScript types: `npx supabase gen types typescript ...` → `src/services/supabase/database.types.ts` (generated file — never hand-edit).

## Environment variables

Defined in `.env.example`. Secrets live only in `.env.local` (local) and in the Vercel/Supabase dashboards (production):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public client config.
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never exposed to the browser.
- `QR_TOKEN_SECRET` — signs the rotating QR tokens (HMAC).
- `CRON_SECRET` — protects the daily cron endpoint.
- `NEXT_PUBLIC_GYM_NAME` etc. — white-label basics where needed.

## Explicitly NOT used (MVP)

- No native app frameworks (React Native / Flutter) — PWA first, per `PRD.md` non-goals.
- No separate backend server (Express/Nest) — Next.js route handlers + Supabase are enough.
- No Redis / queues — the daily scan is a single cron job.
- No state library (Redux/Zustand) — server components + URL state + local component state cover the MVP.
- No paid analytics — the owner dashboard KPIs are the analytics for the pilot.

## Cost at pilot scale

Vercel free tier + Supabase free tier + `wa.me` links = **≈ ₹0/month infrastructure**. Costs appear only when adding Razorpay (transaction fees), SMS OTP, or a paid WhatsApp provider — all post-pilot decisions.

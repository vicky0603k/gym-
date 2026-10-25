# SECURITY — Gym Retention PWA

Security and privacy rules for this project. These are requirements, not suggestions. Related: `DATABASE.md` (RLS), `API.md` (actions), `docs/decisions.md` (why manual payments in the MVP).

## 1. Authentication

- Owner / front-desk: Supabase Auth, email + strong password. Passwords are never stored or handled by application code.
- Member: phone number + 4-digit PIN, stored only as a salted scrypt hash (`scrypt$salt$hash`, migration 012). Unknown phones are hashed too, so timing doesn't reveal which numbers exist. Login failures return one generic message (never "phone not found" vs "wrong PIN").
- PIN brute force: after repeated failures for a phone number, apply a cooldown and surface a staff-assisted reset. PIN reset is done by staff in person/at the desk and is audit-logged.
- Sessions: use the platform's secure, httpOnly cookie mechanisms. Never store tokens or PINs in `localStorage`.

## 2. Authorisation — Row Level Security is the boundary

- RLS is **enabled on every table**, with no exceptions. A table without a policy is treated as a launch-blocking bug.
- Members can read only their own rows (member, memberships, attendance, orders, payments, notifications, and their own case status). Members cannot directly write payments, cases, follow-ups or membership state.
- FrontDesk gets daily-work access only; only Owner can change `settings`, prices, verify/refund payments, or read the full audit log.
- All money/membership mutations run through server-side service functions using the service role **on the server only**. The service role key must never appear in client code, bundles, logs or this repository.
- UI-level hiding of buttons is not security. Every server action re-checks the caller's role and ownership.

## 3. QR integrity

- The gate QR contains an HMAC-signed token (secret in `QR_TOKEN_SECRET`, server-only), bound to the gym and a 45-second time step.
- The server accepts the current and immediately previous step only. Anything older, unsigned, or tampered is rejected and logged.
- A static, printed QR must never be accepted for check-in. (A printed QR that merely opens the app/website URL is fine — it carries no check-in authority.)
- Duplicate window: a second valid scan within 3 hours is a no-op with a friendly message.

## 4. Payment integrity

- The app **never collects or stores card, UPI PIN, or bank credentials** — in the MVP the member pays outside the app (UPI) and the owner verifies receipt; in Phase 1.5 Razorpay handles all payment data.
- A payment is `Paid` only through `verifyPayment` (MVP: owner action) or, later, a **verified Razorpay webhook signature**. A client-side "success" callback alone never marks anything Paid.
- Verification is idempotent: the state machine allows `Pending → Paid` once. Membership extension happens in the same transaction.
- Refunds/reversals are separate recorded adjustments with audit entries; financial rows are never deleted or silently edited.
- Every Paid payment should carry a `provider_ref`; a Paid row without one raises a data-quality alert.

## 5. Audit

- `audit_logs` is append-only: no role has update or delete access, including Owner.
- Mandatory audit events: assisted check-in, attendance correction, member pause/resume/status change, payment verify/reject/refund, plan price change, settings change, PIN reset.
- Each entry records actor, action, affected record, a human-readable summary, and timestamp.

## 6. Privacy and consent

- Collect the minimum: name, phone, membership and attendance data. Nothing else is required for the MVP (no Aadhaar, no card data, no location tracking).
- Marketing messages and service messages are separate categories. Marketing requires `marketing_consent = true`; opt-out takes effect immediately and is itself recorded.
- Message templates make no medical, transformation, or income claims (see `API.md` templates).
- Data sharing: member data belongs to the gym's business; it is never sold, shared with third parties, or used for any other gym's deployment.
- Deletion requests: a member who has left can be marked Cancelled/Blocked immediately; financial and audit history is retained (legal/business record) while personal profile fields can be anonymised on the owner's request.

## 7. Secrets and configuration

- Secrets live only in `.env.local` (local dev) and the Vercel / Supabase dashboards (production). `.env.example` contains names only, never real values.
- `.env.local`, keys and service-role credentials must never be committed, pasted into an AI chat (Kiro/Claude Code included), or printed in logs or error messages.
- Rotate `QR_TOKEN_SECRET` and `CRON_SECRET` if exposure is ever suspected.

## 8. Platform and dependency hygiene

- The cron endpoint rejects any call without the correct `CRON_SECRET` bearer token.
- Keep dependencies updated; run `npm audit` before the pilot launch and fix high-severity issues.
- Status 25 Oct 2026: Next.js moved to 14.2.35 (fixes the critical middleware authorization bypass and the other 14.x advisories); the unused image optimizer is switched off (`images.unoptimized`). Still open, needing a major upgrade (owner decision): remaining Next.js advisories fixed only in 15.5+, zod < 4.6.6 (memory use on oversized input — our inputs are small form fields), and build-time-only Serwist/PostCSS.
- Error responses never expose stack traces, SQL, table names, or whether a phone number exists in the system.
- Rate-limit sensitive actions at the platform layer where available (login attempts, invalid QR attempts).

## 9. Before-launch security checklist

- [ ] RLS enabled and policy-tested on every table (member A vs member B test from `TESTING.md`)
- [ ] Service role key appears nowhere in client code or the repo (search the codebase)
- [ ] QR token rejects old/tampered values; secret set in production env
- [ ] Cron endpoint rejects unauthenticated calls
- [ ] Payment double-verify test passes (checklist row 6 in `TESTING.md`)
- [ ] Audit log has no update/delete path; mandatory events are being written
- [ ] Seed credentials are not present in the production database
- [ ] `.env.local` is git-ignored; production env vars are set in Vercel only

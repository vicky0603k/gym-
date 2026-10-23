# Product — Gym Retention PWA

A mobile-first PWA sold to a single local Indian gym (per deployment) to reduce silent member churn.

**Core loop:** QR attendance → 10+ day absent member appears on Red List → staff follow-up (call/WhatsApp, outcome recorded) → member returns → renewal collected on time → PT/diet/supplement add-ons sold transparently.

**Users:** Member (QR check-in, streak/weekly goal, renewal, add-ons) · Owner/Manager (dashboard, red list, plans, payments, add-ons) · Front-desk staff (assisted check-in, member lookup, follow-ups). Trainer is NOT a full role in MVP.

**Business rules that define the product:**
- No-show threshold default 10 days, configurable per gym; paused/frozen/expired/cancelled members are never red-listed.
- Streak = weekly visit goal, never daily calendar streak.
- Membership extends only after verified payment, exactly once.
- Add-ons are always optional, never pre-selected, no medical/transformation/income promises anywhere in UI copy.
- Success is measured by: red-list return rate, on-time renewal rate, QR adoption — the dashboard must surface these, not decorative charts.

**Out of scope (MVP):** workout library, AI diet, wearables, multi-branch, trainer app, payroll/commissions, real payment gateway (Razorpay after pilot — keep payment states gateway-ready).

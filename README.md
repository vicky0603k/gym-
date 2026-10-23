# Gym Retention PWA

A mobile-first Progressive Web App for a single local gym in India that reduces silent member churn, collects renewals on time, and sells add-ons — all from one website that installs on a phone like an app, with no Play Store release.

**The loop this product is built around:**
QR attendance → member absent 10+ days appears on the owner's Red List → staff follow up (call / WhatsApp, outcome recorded) → member returns → renewal is collected before expiry → PT / diet / supplement add-ons are offered transparently.

## What is included

- **Public website** — gym landing page: photos, plans, trainers, timings, address, login entry.
- **Member web app** — QR check-in, weekly visit goal, attendance history, renewal with payment, add-on store, notification preferences.
- **Owner dashboard** — today's check-ins, active members, Red List with follow-up workflow, renewal pipeline and payment verification, add-on orders, settings.

## Quick start (after code is generated)

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL, keys and QR secret
npm run dev                  # http://localhost:3000
```

- Supabase: create a project, run the SQL files in `supabase/migrations/` in order, then run `supabase/seed.sql` for demo data.
- Demo logins are listed in `supabase/seed.sql` (owner, front-desk, and sample members using phone + PIN).

## Documentation map — read in this order

| File | What it covers |
|---|---|
| `PRD.md` | Product requirements: problem, users, scope, business model, success metrics |
| `DESIGN.md` | Screens, user flows, visual design system, UI states |
| `TECH_STACK.md` | Every technology choice and why |
| `ARCHITECTURE.md` | System design, folder structure, data flows, background jobs |
| `DATABASE.md` | All tables, columns, relationships, indexes, security policies |
| `API.md` | Endpoints, server actions, request/response and error conventions |
| `TASKS.md` | Build order — module-by-module checklist |
| `TESTING.md` | Test plan and the mandatory failure checklist |
| `SECURITY.md` | Auth, QR security, payment integrity, privacy rules |
| `DEPLOYMENT.md` | Vercel + Supabase deployment and go-live checklist |
| `AGENTS.md` | Rules for any AI agent (Kiro / Claude Code) working on this repo |
| `docs/assets.md` | Logo, icons, photos and other assets required |
| `docs/decisions.md` | Architecture Decision Records — why key choices were made |
| `.kiro/` | Kiro steering files and the spec (requirements / design / tasks) for this app |

## Status

Pre-development. All planning documents are complete and ready to load into Kiro. Build follows `TASKS.md` one module at a time, with the tests in `TESTING.md` passing before the next module starts.

## Pilot model

30-day free pilot with one local gym (real member data, staff uses it daily, weekly feedback call), then a one-time setup fee and a monthly fee per gym. Pricing details and assumptions are in `PRD.md`.

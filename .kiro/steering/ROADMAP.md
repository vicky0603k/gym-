# Roadmap — Gym Retention PWA

**Product direction, release stages, and the gates between them.**
Build sequence lives in `PHASE_PLAN.md` / `TASKS.md`; scope lives in `PRD.md`. This file answers a different question: **where this product goes, in what order, and how we know each stage is finished.**

---

## 0. Product direction — read this first (binding decision)

This product is **software for gym owners (B2B)**. It is **not** a marketplace for gym-goers, and it is **not** both.

| Question | Decision |
|---|---|
| Who is the paying customer? | **The gym owner.** Gyms pay a setup fee and a monthly fee. |
| Who are the users? | The gym's owner/staff (dashboard) and that gym's own members (member app). |
| What is the public website? | **One gym's own branded site** — its photos, its plans, its trainers, its login. It is NOT a listing of many gyms. |
| Can the public browse many gyms, compare them, or buy passes across gyms? | **No.** That is a marketplace, and a marketplace is a different product with different architecture. It is not part of this product (see Stage 5 for the only way it could ever be reconsidered). |
| How is each gym served? | MVP and pilot: **one deployment per gym** (own database, own site). Self-serve sign-up for many gyms is a later stage (Stage 4), not the MVP. |

**Architecture consequence:** everything is designed around *one gym's data per deployment* — members, plans, payments and branding all belong to a single gym. Do not add marketplace features (multi-gym browsing, search across gyms, cross-gym passes, public reviews), multi-tenancy, or public self-serve registration at any earlier stage than this roadmap states. Any AI agent that proposes them is out of scope: see ADR-012 in `docs/decisions.md`.

---

## Stage 0 — Planning and Documentation ✅ Done
**Goal:** A complete, reviewed specification so an AI agent can build without guessing.
- **Delivered:** PRD, DESIGN, TECH_STACK, ARCHITECTURE, DATABASE, API, TASKS, PHASE_PLAN, TESTING, SECURITY, DEPLOYMENT, REAL_WORLD_STANDARD, AGENTS, Kiro spec + steering, Ponytail rules.
- **Exit gate:** Kiro's read-out reviewed, all document conflicts resolved (ADR-009 to ADR-012). ✅ Passed 23 Oct 2026.

## Stage 1 — MVP Build (in progress)
**Goal:** A complete, real-world-quality, working product for ONE gym — the 4 core loops running end to end: QR check-in → Red List follow-up → renewal + verified payment → add-ons.
- **Delivered by:** The 12 AI phases in `PHASE_PLAN.md` (setup → PWA shell → database → seed → auth → members/plans → QR → weekly goal → Red List → renewal/payment → add-ons/dashboard/landing/settings → testing/deploy).
- **Includes:** Per-gym branded public landing page, member PWA, owner dashboard, manual UPI payment with owner verification, WhatsApp `wa.me` follow-up links.
- **Explicitly NOT in this stage:** Online payment gateway, automated messaging, offline check-in queue, trainer app, self-serve gym sign-up, multi-gym anything.
- **Exit gate (all must be true):** `TESTING.md` 18-point failure checklist passes on production; owner/staff/member UAT passes with real people; dashboard numbers match raw data; the app passes the `REAL_WORLD_STANDARD.md` quality gate on every screen.

## Stage 2 — 30-Day Pilot with One Real Gym
**Goal:** Proof, not features. One local gym runs its real daily operations on the product for 30 days.
- **Week 0 — Setup:** Owner discovery answers confirmed in writing (`PRD.md` §11), real member data imported and count-verified, staff trained (QR display, assisted check-in, follow-up entry), owner trained (Red List, payment verification).
- **Weeks 1–4:** Daily staff use, weekly review call against the pilot metrics.
- **Measured (from `PRD.md` §9):** QR adoption %, Red List return rate, on-time renewal rate, payment recovery, daily staff usage.
- **Explicitly NOT in this stage:** New features. Bugs are fixed; feature requests are written down for Stage 3, not built mid-pilot.
- **Exit gate:** The success definition agreed with the owner before launch is met (example: at least 5 absent members returned, or a measurable improvement in on-time renewals), **and** the owner agrees to continue as a paying customer.

## Stage 3 — First Paid Release (v1.1)
**Goal:** Turn the proven pilot into a repeatable paid product for the first few gyms.
- **Features:** Razorpay online payments with verified webhooks (replacing manual verification as the primary flow — manual stays as fallback); automated WhatsApp reminders via a paid provider (transactional first, marketing only with consent); receipt sharing; onboarding checklist so a second/third gym can be set up by configuration and data import, still as separate deployments.
- **Business:** Final pricing confirmed from the pilot (setup + monthly per gym), a one-page agreement, and a support routine (update windows, backup/export rhythm from `DEPLOYMENT.md`).
- **Exit gate:** At least 2 gyms paying monthly, renewal collection running through Razorpay for a full month with zero payment-integrity failures.

## Stage 4 — SaaS Evolution (only after Stage 3)
**Goal:** Many gyms on one platform — *this is where "each gym signs up and gets its own dashboard and branded site" belongs, and not before.*
- **Features:** Multi-tenancy (`gym_id` on every table and policy, subdomain or path-based branded site per gym), gym self-serve sign-up and onboarding, platform-level admin (only for the product owner: gym list, plan/billing status, health metrics), subscription billing for the gyms themselves, trainer role/app, offline check-in queue with audit sync.
- **This is an architecture migration, not a small feature** — it gets its own PRD update, its own spec, and its own decision records before any code is written.
- **Exit gate:** A new gym can sign up, brand its site, import members, and run its first week of check-ins with no developer involvement.

## Stage 5 — Marketplace Option (not committed — decision point only)
**Goal:** None yet. This stage exists in the roadmap **only to make the boundary explicit.**
- A public marketplace (browse many gyms, compare, buy day passes/memberships across gyms) would be a **separate product decision**, made only if Stage 4 data shows real demand for it (e.g. gyms asking for discovery/leads more than for retention).
- If it is ever approved, it gets its own PRD, its own architecture (public catalogue, search, cross-gym payments and revenue share, reviews/moderation), and it consumes the Stage 4 platform as a backend — it is never bolted onto the single-gym MVP.
- **Until a decision record explicitly approves it, no marketplace work of any kind is in scope.**

---

## Timeline (indicative — a planning aid, not a promise)

| Stage | Rough duration | Depends on |
|---|---|---|
| Stage 0 — Planning | Done (Oct 2026) | — |
| Stage 1 — MVP build | ~2 weeks of phase-by-phase build + testing | AI phases completed in order, human testing after each |
| Stage 2 — Pilot | 30 days | One gym owner agreeing to the pilot terms |
| Stage 3 — Paid release | ~3–4 weeks | Pilot success gate passed |
| Stage 4 — SaaS evolution | Later quarter, scoped separately | At least 2 paying gyms + demand for self-serve |
| Stage 5 — Marketplace | No timeline | A separate, explicit decision |

## Roadmap rules

- **Gates, not dates, move the product forward.** A stage starts only when the previous stage's exit gate passes.
- **No stage-skipping features.** If an idea belongs to a later stage, it is recorded (in `docs/decisions.md` or the PRD backlog), not built early "while we're here".
- **Changes to this roadmap are decisions.** Add a decision record, update this file, and tell every agent working on the project — a roadmap changed silently is how scope explodes.
- **The paying customer never changes quietly.** Stage 1–4 sell to gym owners. Selling to gym-goers (Stage 5) would change pricing, marketing, support and architecture — it is treated as a new product, not a feature.

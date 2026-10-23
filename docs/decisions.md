# Decisions — Architecture Decision Records (ADR)

A log of the important choices made for this project, why they were made, and what was rejected. When a decision changes, add a new entry that supersedes the old one — do not silently edit history. Newest entries at the bottom of each section's list; keep numbering sequential.

**Status values:** Accepted · Superseded · Proposed

---

### ADR-001 — Build a PWA, not a native app
**Status:** Accepted (22 Oct 2026)
**Decision:** The product is a website that becomes an installable PWA. No Android/iOS native app and no store release in the MVP.
**Why:** Zero install friction for members (QR/link opens it in the browser), one codebase for website + member app + owner dashboard, no store review delays or developer-account fees while the business model is still being proven with one gym.
**Rejected:** React Native / Flutter native app (faster to build later, if ever, once the pilot proves members actually use it daily).

### ADR-002 — Next.js + Supabase as the stack
**Status:** Accepted (22 Oct 2026)
**Decision:** Next.js (App Router, TypeScript) on Vercel, Supabase Postgres + Auth + RLS as the backend.
**Why:** Matches the developer's existing React/TypeScript skills, one repo serves UI + API, free tiers make pilot infrastructure cost ≈ ₹0, and RLS gives enforceable per-member data isolation without building a custom backend.
**Rejected:** A separate Express backend (more moving parts and hosting cost), Firebase (weaker fit for the relational membership/payment data and reporting queries this product depends on).

### ADR-003 — One deployment serves one gym (no multi-tenancy in the MVP)
**Status:** Accepted (22 Oct 2026)
**Decision:** Each gym gets its own deployment and database. No `gym_id` tenancy layer in the MVP schema (the QR token carries a gym identifier only as a label).
**Why:** The pilot is one gym. Tenancy adds complexity to every table and policy; per-gym deployments make data isolation absolute and pricing simple.
**Consequence:** Selling to many gyms later means either automating per-gym deployment or doing the Phase 2 tenancy migration — accepted knowingly.

### ADR-004 — Manual UPI payment + owner verification in the MVP
**Status:** Accepted (22 Oct 2026)
**Decision:** Members pay by UPI outside the app; the owner verifies receipt in the dashboard; only then does the membership extend. Razorpay is Phase 1.5.
**Why:** Proves the renewal loop at zero integration cost and zero gateway onboarding (KYC, etc.) delay for the pilot.
**Safeguards:** Payment states are gateway-ready (`Created, Pending, Paid, Failed, Refunded`), verification is transactional and idempotent, so the Razorpay webhook can later drive the exact same transition.
**Rejected:** Integrating Razorpay before the pilot (delays launch, and the pilot's real question is retention behaviour, not payment technology).

### ADR-005 — Weekly goal instead of a daily streak
**Status:** Accepted (22 Oct 2026)
**Decision:** Member motivation is a weekly visit goal (default 4/week). There is no daily calendar streak.
**Why:** Most members train 3–5 days a week; a daily streak punishes rest days and approved pauses, feels unfair, and would push members away — the opposite of this product's purpose.
**Rejected:** Duolingo-style daily streaks (kept only as a possible opt-in challenge feature in Phase 2).

### ADR-006 — Rotating signed QR, never a static check-in QR
**Status:** Accepted (22 Oct 2026)
**Decision:** The gate QR is an HMAC-signed token rotating every 45 seconds, displayed on a screen at the gym.
**Why:** A static QR gets screenshotted and shared within days, making attendance data (and therefore the Red List and every KPI) worthless.
**Consequence:** The gym needs a phone/tablet at the gate for the display screen — accepted, and listed in `docs/assets.md`.

### ADR-007 — Member login is phone + PIN (not email, not OTP in the MVP)
**Status:** Accepted (22 Oct 2026)
**Decision:** Members log in with their mobile number and a 4-digit PIN (hashed). Staff-assisted reset at the desk.
**Why:** Members of a local gym will not manage email passwords; SMS OTP costs money per message and adds a vendor dependency before the pilot proves value.
**Consequence:** PIN brute-force protection (cooldown + assisted reset) is mandatory — see `SECURITY.md`.

### ADR-008 — Build AI-assisted, spec-first, one module at a time
**Status:** Accepted (22 Oct 2026)
**Decision:** The app is built with an AI coding agent (Kiro preferred) driven by this documentation set and the spec in `.kiro/specs/`, strictly module-by-module per `TASKS.md`, with human testing and a git commit after each module.
**Why:** A single "build the whole app" prompt produces inconsistent schema, half-finished payment logic and untestable output. Spec-first keeps the AI anchored to the PRD, and module gates keep bugs from compounding.
**Rejected:** Vibe-coding the whole MVP in one session; running two AI agents on the same repo at the same time.

---

## Template for new entries

### ADR-XXX — Title
**Status:** Proposed / Accepted (date)
**Decision:** What was decided, in one or two sentences.
**Why:** The reasons, including the business reason, not just the technical one.
**Rejected / Consequence:** What was not chosen, and/or what this decision costs us later.

### ADR-009 — Renewal windows: 14 days is owner-only, member reminders at 7/3/0/−3
**Status:** Accepted (23 Oct 2026, resolving a conflict Kiro found between PRD/API and DATABASE/TASKS)
**Decision:** The renewal pipeline has five stages {14, 7, 3, 0, −3} days relative to expiry, but the 14-day stage is only a heads-up view for the owner. Member reminder notifications fire at four stages only: 7 days before, 3 days before, expiry day, and 3 days after.
**Why:** Fourteen days is too early to message a member (it trains them to ignore reminders), but the owner benefits from seeing the two-week pipeline for cash-flow planning.

### ADR-010 — Weekly goal is computed, no streaks table in the MVP
**Status:** Accepted (23 Oct 2026, resolving a question Kiro raised from DATABASE.md)
**Decision:** Do not create a `streaks` table. Weekly-goal state is computed on read from the `attendance` table.
**Why:** A pilot gym has a few hundred members at most; indexed attendance queries are instant at that scale, and a cache table would have to be kept in sync on every check-in — a bug source with no benefit yet.
**Consequence:** If a future multi-gym version makes dashboard queries slow, add the cache table then, behind the same service interface.

### ADR-011 — No offline check-in queue in the MVP (confirmation)
**Status:** Accepted (23 Oct 2026, resolving a direct contradiction between ARCHITECTURE.md and the Kiro spec design.md)
**Decision:** ARCHITECTURE.md §5 is binding: attendance is never queued offline in the MVP. The member sees the offline page and is directed to front-desk assisted check-in. The spec design.md note suggesting a basic offline queue is removed; an audited offline queue is a Phase 2 candidate only.

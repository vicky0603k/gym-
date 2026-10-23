# AGENTS.md — Instructions for AI agents working on this repository

For Kiro, Claude Code, or any other AI coding agent. Human developers should read this too — it is the project's working agreement. Product truth is in `PRD.md`; if this file and the PRD ever disagree, the PRD wins on *what* to build and this file wins on *how* to work.

## Before you write any code

1. Read, in this order: `PRD.md` → `DESIGN.md` → `ARCHITECTURE.md` → `DATABASE.md` → `API.md` → `TECH_STACK.md` → `SECURITY.md` → the current module in `TASKS.md`.
2. For Kiro: the steering files in `.kiro/steering/` and the spec in `.kiro/specs/gym-retention-system/` are the same project described in Kiro's format. Keep both views consistent — if you change a rule, update the document it came from and say so.
3. State your plan before editing: which module you are building, which files you will create or change, and which assumptions you are making. Wait for approval on anything that changes scope, stack, schema, or a business rule.

## How to work

- **One module at a time**, in the order in `TASKS.md`. Never build ahead into the next module, and never build Phase 2 features.
- After finishing a module: run `npm run build` and the module's tests/`Verify` checks, report the result honestly (passed / failed / not run — with the error text when it failed), and stop. The human tests and commits before the next module.
- Keep changes small and scoped to the module. Do not refactor unrelated code, rename things for style, or swap libraries.
- If a requirement is unclear, ask instead of guessing — especially for anything touching money, dates, QR security, or who can see whose data.

## Rules that must never be broken

- **Payments:** a membership extends only when a payment becomes `Paid` through the verified path in `API.md`, inside one transaction, and exactly once. Never extend on "payment initiated" or on a client-side callback alone. Never store card/UPI credentials.
- **QR:** never accept a static QR or an unsigned/expired token. Tokens are HMAC-signed, rotate every 45 seconds, and old steps are rejected (see `SECURITY.md`).
- **Red List:** never include Paused, Frozen, Expired or Cancelled members. Never create a second open case for the same member. Never delete follow-up or audit history.
- **Dates:** all business date logic (expiry, absence, weeks) goes through the Asia/Kolkata helpers in `src/utils/dates.ts`. Never use raw UTC dates for business rules.
- **Streak:** the streak is a weekly visit goal. Never implement a daily calendar streak, and never let rest days or approved pauses count against a member.
- **Add-ons:** never pre-select an add-on anywhere. Always check stock/trainer availability before creating an order. Stock and PT usage can never go negative or over the purchased total.
- **Access:** a member can only ever access their own data. RLS policies are mandatory on every new table — if you add a table, you add its policies in the same migration batch.
- **Secrets:** never read, print, commit, or ask the human to paste `.env.local` values. Never add real credentials to seed files, tests, or docs.

## Code conventions

- TypeScript strict; Zod schemas for every form and server-action input.
- Server Components by default; Client Components only for interactive pieces (scanner, forms, dialogs).
- Business logic lives in `src/services/`; components call services or receive server-fetched data — components never import the Supabase client directly.
- All schema changes are new numbered files in `supabase/migrations/`. Never edit a migration that has already run anywhere.
- Components under ~200 lines. Every list screen ships loading, empty and error states in the same task as the list itself.
- Amounts are integer rupees, displayed with `Intl.NumberFormat('en-IN')` and ₹.
- Follow the patterns of nearby code in the repo over patterns from your training data.

## Definition of done (every task)

- `npm run build` passes and lint has no new errors.
- Unit tests for any new logic in `services/` or `utils/` are written and passing (`TESTING.md`).
- The module's `Verify` items in `TASKS.md` have been executed, not just assumed.
- Mobile layout checked at 375px for any screen touched.
- The real-world quality gate in `REAL_WORLD_STANDARD.md` §9 passes for every screen touched: no placeholder/demo content, no dead buttons, all four UI states present, Indian formats throughout. A task whose features work but which looks or behaves like a sample app is NOT done.
- No secrets, no debug logging of personal data, no TODOs left in payment/QR/auth code paths.
- Your final message reports: files changed, what was tested and its result, and anything left uncertain.

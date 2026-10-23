# Structure

Repository layout (documents at root, code under `src/`):

```
/
  PRD.md  DESIGN.md  TECH_STACK.md  ARCHITECTURE.md  DATABASE.md  API.md
  TASKS.md  TESTING.md  SECURITY.md  DEPLOYMENT.md  AGENTS.md  README.md
  .kiro/steering/            product context for the AI agent
  .kiro/specs/gym-retention-system/   requirements, design, tasks for this app
  docs/                      assets.md, decisions.md
  src/
    app/                     Next.js App Router routes — this is the pages layer:
                             (public)/ landing, member/, owner/, api/, manifest, sw
    components/              UI only, no DB calls (ui/, qr-scanner, stat-card, member-row...)
    services/                Business logic + data access: supabase clients, qr, red-list,
                             streak, payments, auth, notifications
    hooks/                   React hooks (useInstallPrompt, useQrScanner, ...)
    utils/                   dates (Asia/Kolkata), currency (en-IN), formatting, constants
  supabase/migrations/       All schema changes, in numbered order
  supabase/seed.sql          Demo data
  tests/                     Unit + end-to-end tests and the failure checklist scripts
  public/icons/              PWA icons
```

**Conventions:** Server Components by default; Client Components only where interactive (scanner, forms). Components under 200 lines. Business logic lives in `src/services/`, never inside a component. Every list screen has loading, empty and error states. Amounts formatted with `Intl.NumberFormat('en-IN')` and ₹.

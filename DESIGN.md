# DESIGN — Gym Retention PWA

UI/UX design specification. Business scope lives in `PRD.md`; data and APIs live in `DATABASE.md` and `API.md`.

## 1. Design principles

- **Mobile-first, always.** Every screen is designed at 375px width first; desktop is an expanded view of the owner dashboard only.
- **Few taps.** The member's only repeated action is QR check-in — it must complete in at most 3 taps and under 5 seconds.
- **Actionable, not decorative.** Owner screens prioritise lists the owner must act on today (call list, due renewals, failed payments) over charts.
- **Honest UI.** No fake urgency, no hidden charges, no pre-selected add-ons, no medical or transformation promises anywhere.
- **Every state exists.** Each screen ships with loading, empty, success and error states. An error is a full, plain-language message — never a blank screen or a raw exception.

## 2. Visual system

- **Theme — "Iron & Volt" (light, ADR-012, 25 Oct 2026):** white and black like a sportswear brand, one neon-yellow "volt" highlight, tall condensed numbers. Light and high-contrast so it reads in bright gym light. Full rationale and rules in `UI.md` §3.
- **Colour tokens** (`tailwind.config.ts` is the single source; no hex values in components):

  | Token | Value | Role |
  |---|---|---|
  | `background` | `#FFFFFF` | Page ground |
  | `surface` | `#F3F3EF` | Cards, bottom nav, sidebar |
  | `surface-2` | `#E8E8E2` | Chips, skeletons, hover, empty plate slots |
  | `border` | `#E2E2DC` | Dividers, card outlines |
  | `border-strong` | `#7A7A72` | Input outlines (meets 3:1 for form controls) |
  | `foreground` | `#0E0E0E` | Text, icons, black buttons, the membership card |
  | `muted` | `#5E5E58` | Secondary text (6.5:1 on white) |
  | `accent` | `#C6F432` | Volt — **fill only**: primary button, active nav pill, goal met, Active/Paid badges, the date on the black membership card |
  | `accent-foreground` | `#0E0E0E` | Text on volt |
  | `accent-muted` | `#B4E11F` | Volt hover/pressed |
  | `success` | `#2E7D0F` | Success text and icons |
  | `warning` | `#B45309` | Due soon, pending, paused only |
  | `danger` | `#C62828` | Risk only — Red List, expired, failed payment |

  Volt on white is 1.3:1: it is never text, an icon, a focus ring or a thin line on a light surface — only a fill under black text, or text on a black surface.
- **Typography:** Archivo (variable, width axis) via `next/font`, latin + latin-ext (₹ glyph). Body/UI at normal width 400–700; member body text ≥ 16px. Display figures (expiry date, visits, KPIs, prices) use `.num-display` / `.kpi-number`: condensed (`font-stretch: 72%`), 800–900 weight, tabular figures. Uppercase only on the big hero figures; everything else sentence case.
- **Signature details:** member home is a black membership card with the expiry in condensed volt; the weekly goal is shown as plates loading on a bar; primary actions are volt with black text; the active nav item sits on a black tile (mockup C). Shared primitives: `src/components/ui/`.
- **Tap targets:** Minimum 48px height for all primary buttons and list actions (Call, WhatsApp, Mark Outcome).
- **Currency:** All amounts in ₹ with Indian formatting (`en-IN`), e.g. ₹1,20,000 — never $ or Western grouping.
- **Language:** Simple English labels; short Hinglish phrases allowed in member-facing motivational copy and message templates (see API.md templates). No Hinglish in owner financial screens.

## 3. Information architecture

```
Public
  Landing page — hero, photos, plans, trainers, timings, address, Login / Join
  Login — owner (email) / member (phone + PIN) tabs or role detection

Member (bottom navigation: Home, Check-in, Renew, Add-ons, More)
  Home — membership card (plan, expiry), weekly goal ring/bar, streak, quick actions
  Check-in — camera scanner view + result states
  History — attendance list by date (under More in v1 is acceptable)
  Renew — current plan, options 3/6/12 months, final amount, pay, receipt
  Add-ons — PT / Diet / Products cards, detail, buy
  Settings — notifications, marketing opt-out, profile

Owner (side/bottom navigation: Dashboard, Red List, Members, Renewals, Add-ons, Settings)
  Dashboard — KPI cards + today's action lists
  QR Display — full-screen rotating gate QR (meant for a desk tablet / printed standee screen)
  Red List — filter chips (10–14 / 15–21 / 22+ days, expiring soon) + member rows
  Members — search, list, member detail, add/edit, pause/resume
  Plans — plan CRUD (under Settings in v1 is acceptable)
  Renewals — due pipeline by stage, pending payment verification queue
  Add-ons — catalogue CRUD, orders, PT usage, stock
  Settings — gym profile, threshold, reminder timings, staff accounts
```

## 4. The four core screens (detail)

### 4.1 QR Check-in + Weekly Goal (member)
- Scanner fills the screen; a frame guide and "point at the gym QR" hint.
- Result states, each full-screen with icon + one-line message + next action:
  - **Success:** "Checked in" + updated weekly goal (e.g. 3 of 4 this week).
  - **Duplicate:** "Already checked in at 7:42 AM."
  - **Invalid / expired QR:** "This QR has expired. Please scan the current QR at the gate."
  - **Expired membership:** message + **Renew now** button.
  - **Paused membership:** message + front-desk contact action.
- Home shows the weekly goal as a progress bar or ring, never as a daily streak flame that punishes rest days.

### 4.2 No-Show Red List (owner)
- Header summary: total open cases, due follow-ups today.
- Row: initials avatar, name, absent days (bold, red at 15+), last visit date, plan + expiry, trainer.
- Actions per row: **Call** (tel: link), **WhatsApp** (prefilled caring message), **Mark Outcome** (bottom sheet: outcome list + next action date + optional note).
- Empty state is a success state: "No one is at risk today. 🎉" with today's check-in count.

### 4.3 Renewal (member + owner)
- Member: current plan card, exact expiry date, plan option cards (duration, base price, discount, **final payable** in bold, benefits, terms link). One primary button: Pay.
- Payment result states: success (receipt with new expiry), pending (what happens next, no panic copy), failed (retry + help, and a note that a debited amount follows the provider's process — MVP manual flow states the owner will confirm).
- Owner pipeline groups: *Due in 7 days · Due in 3 days · Expires today · Overdue* with expected collection totals, and a separate **Pending verification** queue with Verify / Reject actions.

### 4.4 Add-ons (member + owner)
- Cards: name, outcome line, price, validity, sessions or stock, trainer/qualification where relevant.
- Detail sheet: inclusions, exclusions, cancellation terms, **Buy** button. Nothing is ever pre-selected or bundled silently.
- Out of stock or trainer unavailable: the Buy action is disabled with the reason shown on the card.
- Owner view: orders with status, PT sessions used/total with a "+1 session" action, stock with low-stock warning.

## 5. Dashboard KPIs (owner home)

Cards, each tapping through to its actionable list: Active members · Today's check-ins · 7-day active members · Open Red List cases · Members returned after follow-up · Renewals due in 7 days (count + ₹ expected) · Renewal collection this month (₹) · Add-on revenue this month (₹) · Follow-ups due today.

## 6. Component inventory

- `ui/` primitives: Button, Input, Card, Badge, Sheet/Dialog, Tabs, Skeleton.
- `stat-card` — KPI number + label + optional delta.
- `member-row` — used in Members and Red List (prop-driven actions).
- `qr-scanner` — camera view + permission-denied fallback ("ask front desk for assisted check-in").
- `qr-display` — the rotating gate QR with countdown ring.
- `outcome-dialog` — follow-up outcome form.
- `install-prompt` — Add to Home Screen guidance, different steps for Android Chrome and iOS Safari.
- `empty-state`, `error-state`, `loading-skeleton` — shared state blocks.

## 7. PWA design requirements

- App icon set (192, 512, maskable) from the gym/Vikas logo (see `docs/assets.md`).
- Splash/theme colour matches the dark theme; app opens full-screen (standalone display mode).
- Offline page: branded, plain message + "attendance will be recorded at the front desk" fallback instruction.
- Install is promoted once, after the member's first successful check-in — never with a blocking popup on first load.

## 8. Accessibility basics

- Contrast ratio at least 4.5:1 for body text on the dark theme.
- All icon-only actions have text labels (owner and staff are not power users).
- Forms show inline errors in plain language, in the field they belong to.

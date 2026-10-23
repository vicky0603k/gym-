# Real-World Standard — Gym Retention PWA

**This product must look, feel and behave like a real product that a gym owner pays for every month — not like a demo, a tutorial project, or an AI sample app.**
This file is the quality bar for every phase in `PHASE_PLAN.md`. If any rule here conflicts with a shortcut the AI wants to take, this file wins.

The test for everything below is one question: **"If the gym owner opened this screen in front of his members, would he feel proud — and would a member trust it with their money?"**

---

## 1. Visual quality — no "simple app" look

- A real design system, applied everywhere: fixed colour tokens (dark gym theme from `DESIGN.md`), one accent colour, consistent spacing scale, consistent corner radius, consistent typography scale. No screen may invent its own styling.
- Use proper **icons (Lucide)** for actions and navigation. **No emoji as UI icons**, no mismatched icon styles.
- Real hierarchy: headings, sub-text, cards and dividers must make a screen scannable in 3 seconds. KPI numbers are large and bold; supporting text is smaller and muted.
- Member app uses a bottom navigation bar; owner app uses clear section navigation. The current section is always visibly highlighted.
- Subtle, purposeful motion only: smooth page transitions, animated weekly-goal progress, a success animation on check-in. No random or heavy animations that slow low-end phones.
- Every image is a real, relevant gym image or a designed graphic panel (see `docs/assets.md`). **Never** hotlink random internet images, and never leave grey "image here" boxes in a finished screen.

## 2. Banned — the "demo smell" list

None of the following may exist in any completed phase:

- "Lorem ipsum", "Sample Gym", "Test User", "John Doe", "ABC Fitness" or any placeholder text presented as real content
- Buttons or links that do nothing, open empty pages, or show "Coming soon"
- Browser `alert()` / `confirm()` popups — use the app's own dialogs and toasts
- Raw error messages, stack traces, Supabase/Postgres error text, or blank white screens shown to a user
- Hardcoded fake numbers on the dashboard (all figures come from live queries)
- US-style formatting anywhere: money is always ₹ with Indian digit grouping (`en-IN`, e.g. ₹1,20,000), dates in Indian format (e.g. 23 Oct 2026), phone numbers with +91 where displayed internationally
- A screen that only works with the seed data (e.g. breaks or looks empty when a list has 0 or 200 rows)

## 3. Every action must be complete

- **Every visible button works** in the phase it appears in. If a feature belongs to a later phase, the button does not appear yet — it is never shown disabled "for later" without a clear, honest reason.
- Destructive or irreversible actions (pause member, reject payment, refund, mark cancelled) always ask for confirmation in an app dialog, and where the docs require it, a reason.
- After every successful action the user gets feedback: a toast or a clear success state ("Payment verified — membership extended till 14 Feb 2027"), never silent nothing.
- Forms validate inline, in plain language, in the field where the mistake is (e.g. "Enter a 10-digit mobile number") — not one generic error at the top after submission.
- Submit buttons disable themselves while saving, so a double tap can never create two records. Combined with the server-side duplicate guards, double-submits must be impossible end to end.
- Lists longer than one screen have working **search and/or filters** (members, red list, attendance, orders) — an owner with 300 members must never have to scroll through all of them.

## 4. Realistic data — the seed must feel like a real gym

Seed data (Phase 4) must be indistinguishable from a real gym's records:

- Members joined on **different dates spread over the last 18 months** — never all on the same day.
- Attendance follows real patterns: heavy on weekday mornings/evenings, light on Sundays, regulars with 4–5 visits a week, casuals with 1–2, a few members on a declining curve (that is how the 6 Red List members got there — their history must show the decline).
- Names, phone numbers and plan distribution are realistic for an Indian local gym: a mix of Monthly/Quarterly/Yearly members (not all on one plan), families/students/professionals implied by age variety is fine, but no joke or celebrity names.
- Payment amounts always match the plan prices (minus a configured discount where shown). No random amounts.
- Expiry dates are staggered across the coming weeks — that is what makes the renewal pipeline and dashboard look and behave real.
- Trainers have real specialisations (Strength, CrossFit, Zumba, Yoga) and members are distributed across them, not all assigned to one trainer.

## 5. States and feedback — every screen, every time

Every screen and list ships, in the same phase, with:

- **Loading state** — skeleton placeholders shaped like the real content, not a bare spinner on a blank page
- **Empty state** — a designed message plus the next action (e.g. Red List empty = "No one is at risk today" with today's check-in count; no members yet = "Add your first member" button)
- **Error state** — plain-language message with a **Retry** action
- **Success state** — explicit confirmation with the important facts (new expiry, amount, next follow-up date)

## 6. Built for real phones and real gyms

- Primary test device is a **low-to-mid-range Android phone on 4G**, at 375px width, used one-handed, in bright light. If it is slow or hard to tap there, it is not done.
- Minimum 48px tap targets; primary actions reachable by thumb (bottom of the screen for member flows).
- Pages load within 3 seconds on 4G; images are optimised/compressed; no multi-megabyte assets.
- The QR scanner handles real conditions: it asks for camera permission gracefully, explains denial with the front-desk fallback, and gives clear framing guidance.
- Timing realism: the gate QR rotates in real time with a visible countdown; the app never shows a stale QR as valid.

## 7. Business realism

- **Receipts look like receipts:** gym name and logo, member name, plan, amount paid, payment reference, date, and the new expiry date — formatted so the owner could forward it on WhatsApp without embarrassment.
- WhatsApp messages (from `API.md` templates) read like a professional business wrote them — correct name, correct dates, a working link, no placeholders like `{{name}}` ever reaching a real member.
- Call buttons use `tel:`, address links open Google Maps, timings include weekly off/holiday behaviour if the gym has any.
- Payment screens show the **final payable amount before** the member pays, with terms visible — the way a real business must behave.
- The landing page reads like a real gym's website: real plans with real prices, real trainer names, real photos, real timings — it is a sales page for the gym, not a description of the software.

## 8. Trust, safety and production hygiene

- Login screens, payment flows and member data behave as `SECURITY.md` requires — and visibly so (e.g. members see "Only you can see this" cues where relevant, owners see verification status on payments, not just amounts).
- The site has a proper favicon, page titles and meta descriptions, an Open Graph image for the landing page (so a WhatsApp share looks professional), and designed **404 and error pages** in the app theme — never the framework defaults.
- No `console.log` of personal data, no debug panels, no test routes left in the production build.
- Footer of the public site carries the gym's contact and the product's support contact — real products are reachable.

## 9. Per-phase quality gate (mandatory)

Before reporting any phase complete, the AI must confirm, for that phase's screens:

- [ ] No item from the Banned list (§2) is present
- [ ] Loading, empty, error and success states exist (§5)
- [ ] Every button and link on the new screens works (§3)
- [ ] Money, dates and phone numbers use Indian formats (§2)
- [ ] The screens were checked at 375px and still look designed, not squeezed (§6)
- [ ] Seed/demo content shown on these screens follows the realism rules (§4)

A phase that fails this gate is **not complete**, regardless of whether its features technically work.

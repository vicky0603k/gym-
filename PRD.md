# PRD — Gym Retention PWA

**Product Requirements Document | Version 1.0 | 22 October 2026**
**Owner: Vikas Kashyap | Status: Draft for pilot gym**

## 1. Product summary

A mobile-first PWA (a website that installs on a phone like an app) that helps a local gym reduce silent member churn, collect renewals on time, and sell personal training, diet plans and supplements. One codebase serves three surfaces: a public gym website, a member web app, and an owner dashboard.

Working title: **Gym Retention System** (may be white-labelled with the gym's own name and logo).

## 2. Problem statement

A local gym's biggest loss is not a lack of new admissions — it is existing members quietly disappearing:

1. A member attends regularly for 2–3 weeks, then attendance drops.
2. Nobody notices, because attendance sits in a paper register or a biometric device nobody reviews.
3. The member is absent for 10–15 days.
4. The owner finds out only when the fee is not paid — by then the member has mentally quit.

One lost member is roughly ₹1,000–1,500 per month of lost revenue, and there is currently no system to detect the risk early or recover the member.

## 3. Target users

| User | Description | Main pain |
|---|---|---|
| Gym owner / manager | Business owner, phone-first, non-technical | No visibility into who has stopped coming or whose fee is due |
| Front-desk staff | Handles attendance and payments daily | Everything is manual; no follow-up record exists |
| Member | Age roughly 18–40, uses a phone browser | Cannot see their own progress; renewal requires a desk visit |
| Trainer | Not a full role in the MVP | Is only assigned to members and tracked for PT session usage |

## 4. Goals and non-goals

**Goals (MVP)**
- Make attendance automatic and visible through QR check-in.
- Detect a disappearing member within 10 days (Red List + follow-up workflow).
- Collect renewals before expiry (reminder pipeline starting 7 days before).
- Make add-ons (PT, diet, products) a natural part of the member journey.

**Non-goals (explicitly out of the MVP)**
- Workout or exercise library, AI diet plans.
- Native Android/iOS app or store release.
- Multi-branch or franchise support.
- Wearable integrations, payroll, trainer commissions.
- Online payment gateway (Razorpay is Phase 1.5, after the pilot).

## 5. Value proposition and business model

One line for the owner: *"A member who has not come for 10 days lands on your call list every morning — a register will never give you that."*

Value math: 1 member ≈ ₹1,000/month. Retaining just 10 members for a year ≈ ₹1,20,000 in gross membership value.

Pricing to test:
- 30-day free pilot (conditions: real member data, staff uses it daily, one feedback call per week).
- Setup: ₹14,999 one time (₹9,999 founder price for the pilot gym).
- Monthly: ₹999–₹1,499 per gym (hosting, maintenance, support).
- Charged separately: payment gateway setup, WhatsApp API, large member-data imports.

## 6. Core user journeys

- **A. Healthy member:** QR check-in → weekly goal updates → renewal appears 7 days before expiry → chooses a plan → pays → membership extends only after verification → receipt shown.
- **B. Silent churn risk:** Check-ins stop → after the threshold (default 10 days) the member enters the Red List → staff call/WhatsApp and record an outcome → follow-up date set, or an approved pause applied → a return check-in auto-closes the case, history is kept.
- **C. Add-on purchase:** Member views an add-on → price, validity and terms are clear → pays → verification → PT sessions or product order become active and usage is tracked.
- **D. Assisted member:** Staff search by mobile number → assisted check-in with a mandatory reason → entry written to the audit log.

## 7. Functional requirements

### Must have (the MVP is built from this list)
- Member login (phone + 4-digit PIN); owner/staff login (email + password); role-scoped data access.
- Rotating QR check-in (45-second signed token); duplicate scan rejected within 3 hours; all error states handled.
- Assisted check-in with staff identity and mandatory reason, written to the audit log.
- Attendance history (member sees their own, owner sees everyone's).
- Weekly goal streak (default 4 visits/week). Never a daily calendar streak; rest days and approved pauses never break it.
- No-show Red List: automatic daily scan, default threshold 10 days (configurable). Paused, Frozen, Expired and Cancelled members are excluded. One open case per member.
- Follow-up workflow: Call / WhatsApp (wa.me link) / Mark Outcome — Will return, Injured, Travelling, Timing issue, Unhappy, No response, Cancelled — plus a next action date.
- Renewal: plan options (3 / 6 / 12 months as configured), final payable amount, reminder stages at 7 days, 3 days, expiry day, +3 days.
- Payments: states Created, Pending, Paid, Failed, Refunded. MVP flow is manual UPI + owner verification. **A membership never extends before verification, and verifying a payment twice extends it exactly once.**
- Add-on catalogue: PT, Diet, Product — price, validity, sessions/stock, terms. Never pre-selected. Out-of-stock purchases are blocked.
- Owner dashboard: today's check-ins, active members, open Red List cases, renewals due in 7 days, renewal collection, add-on revenue, follow-ups due today.
- Settings: gym profile, plans and prices, no-show threshold, streak rule, pause/freeze rules.
- PWA: installable, home-screen icon, mobile-first at 375px, basic offline page.

### Should have (during the pilot, if time allows)
- Daily owner summary at closing time (check-ins, new Red List members, follow-ups due, renewals paid/pending).
- Shareable receipt (page/PDF).
- Data-quality alerts: membership without an expiry date, Paid payment without a reference, negative stock.

### Could have (Phase 2, only after pilot proof)
- Razorpay online payments with webhook verification.
- Full trainer app, workout programming, body measurements, multi-branch, referral rewards, bulk WhatsApp API.

## 8. Non-functional requirements

- **Performance:** check-in completes in at most 3 taps; pages load within 3 seconds on 4G.
- **Timezone:** all business dates (expiry, absent days, week boundaries) are calculated in `Asia/Kolkata`, never in UTC.
- **Security:** Row Level Security on every table; a member only ever sees their own data; raw card/UPI credentials are never stored; audit history is never deleted.
- **Reliability:** attendance and payment writes are duplicate-safe (idempotent).
- **Usability:** dark gym theme, large tap targets, simple English labels (Hinglish where specified), all amounts in ₹ using Indian number formatting.
- **Cost:** pilot runs on Vercel + Supabase free tiers (≈ ₹0 infrastructure cost).

## 9. Success metrics (measured in the 30-day pilot)

| Metric | Definition |
|---|---|
| QR adoption | % of check-ins done via QR vs assisted |
| Red List return rate | Red-listed members who returned / red-listed members contacted |
| On-time renewal rate | Memberships renewed before expiry / all renewals |
| Payment recovery | Pending/failed payments later marked Paid after follow-up |
| Staff usage | Assisted check-ins and follow-up entries logged daily by front desk |

The pilot's success definition is agreed in writing with the gym owner before launch (example: at least 5 absent members return within 30 days, or a measurable improvement in on-time renewals).

## 10. Assumptions, risks, dependencies

- Assumption: the gym has at least 80–100 active members and staff will run check-ins every day.
- Risk: staff do not use the system → Mitigation: assisted check-in must be faster than the register, and staff training is part of the pilot.
- Risk: QR screenshots are shared to fake attendance → Mitigation: rotating signed QR only; a static printed QR is never used for check-in.
- Risk: members do not install the PWA → Acceptable: every feature also works in the browser; install is a convenience.
- Dependencies: Supabase and Vercel accounts; the gym's real plans, prices and member data; answers to the discovery questions below.

## 11. Open questions (to confirm with the gym owner before the pilot)

1. How many active, paused and expired members are there today?
2. Is a 10-day absence threshold right for this gym, or different?
3. What are the final plans, prices, discounts and freeze rules?
4. Should renewal reminders start 7 days before expiry?
5. How are payments taken today (UPI/cash/app) and how are receipts issued?
6. Who will make Red List calls — the owner or the front desk?
7. Who (qualified) will deliver diet plans?
8. By what number will the owner judge the pilot a success?

---
Documents derived from this PRD: `requirements.md` in the Kiro spec (technical acceptance criteria), `DESIGN.md`, `DATABASE.md`, `API.md` and `TASKS.md`. This PRD is the business-level "what and why"; the specs are the build-level "how".

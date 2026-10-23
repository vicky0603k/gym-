# API — Gym Retention PWA

The interface between screens and the service layer/database. Most operations are **Next.js Server Actions** (typed, same-repo); only two are HTTP route handlers, because external callers need them. Data shapes come from `DATABASE.md`; flows are in `ARCHITECTURE.md`.

## Conventions

- All inputs are validated with Zod. Invalid input returns a typed error — never a 500 with a stack trace.
- Every action returns `{ ok: true, data }` or `{ ok: false, error: { code, message } }` where `message` is plain language safe to show a user.
- Error codes used across the API: `UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION, DUPLICATE_CHECKIN, QR_EXPIRED, QR_INVALID, MEMBERSHIP_EXPIRED, MEMBERSHIP_PAUSED, MEMBER_BLOCKED, MEMBER_CANCELLED, OUT_OF_STOCK, TRAINER_UNAVAILABLE, ALREADY_VERIFIED, INVALID_STATE`.
- Amounts are integer rupees. Dates sent to the client are ISO strings; all display formatting is client-side in Asia/Kolkata.
- Every mutating action writes an `audit_logs` row where `SECURITY.md` requires it.

## HTTP route handlers

### GET /api/qr-token
Returns the current gate QR payload for the owner's display screen.
- Auth: owner/staff session only.
- Response: `{ token, gym_id, expires_in_seconds }` — token is `base64(payload).HMAC`, payload contains the gym id and the current 45-second time step.
- The display screen re-fetches every 45 seconds. The secret never leaves the server.

### GET /api/cron/daily
Runs the daily scan (Red List) and builds renewal reminder + follow-ups-due lists.
- Auth: `Authorization: Bearer <CRON_SECRET>` only (Vercel Cron).
- Idempotent: a second run on the same day creates no duplicate cases or reminders.
- Response: `{ cases_opened, reminders_created, followups_due }` counts for logging.

## Server actions — Member

| Action | Input | Returns / rules |
|---|---|---|
| `memberLogin` | phone, pin | Session scoped to the member. Generic failure message (never reveals whether the phone exists). |
| `checkIn` | qr token | Runs the full gate flow (`ARCHITECTURE.md` 3.1). Possible results: success (+ weekly goal), or `DUPLICATE_CHECKIN / QR_EXPIRED / QR_INVALID / MEMBERSHIP_EXPIRED / MEMBERSHIP_PAUSED / MEMBER_BLOCKED / MEMBER_CANCELLED`. Member status is checked before the membership row. QR and assisted check-in both run the `check_in()` database function (migration 007): one transaction under a per-member advisory lock, so two quick scans can never both pass the duplicate guard. |
| `getMyHome` | — | Plan, expiry, weekly goal (completed/target), open renewal prompt if within the reminder window. |
| `getMyAttendance` | page | Own attendance history, newest first. |
| `createRenewalOrder` | plan_id | Creates renewal order + payment in `Pending`; returns order, final payable amount, UPI instructions. |
| `getMyReceipt` | payment_id | Receipt data for a Paid payment (own payments only). |
| `listAddons` | — | Active add-ons with live stock/availability. |
| `createAddonOrder` | addon_id, qty | Stock/availability checked first (`OUT_OF_STOCK`, `TRAINER_UNAVAILABLE`); creates order + Pending payment. Never pre-selected — always an explicit member action. |
| `updateMyPreferences` | notification + marketing toggles | Marketing opt-out takes effect immediately. |

## Server actions — Owner / Staff

| Action | Input | Returns / rules |
|---|---|---|
| `getDashboard` | — | All KPI counts + today's action lists. Every number is a live query — nothing cached or hardcoded. |
| `listMembers` / `getMember` | search, filters | Search by name or phone. Member detail includes memberships, attendance, cases, orders. |
| `createMember` / `updateMember` / `setMemberStatus` | member fields | Pause/resume writes audit entries; pausing requires a reason. |
| `assistedCheckIn` | member_id, reason (required) | Creates attendance with `source = Assisted`, staff id, reason; resolves an open case like a QR check-in. Missing reason = `VALIDATION` error. |
| `runRedListScan` | — | Manual trigger (Owner) of the same `run_no_show_scan()` the cron runs (migration 008). Same idempotency rules. Absence is counted from the latest of: last visit, join date, end of the last pause, or the last case staff closed — so new members and members back from a pause are not flagged at once. |
| `listRedList` | filter: `10-14 / 15-21 / 22+ / expiring-soon` | Open cases with member, plan, expiry, last visit, absent days, trainer, last follow-up. Only Active members on a running membership are shown. Expiring soon = expiry within 14 days (the owner-only renewal stage). |
| `recordFollowUp` | case_id, channel, outcome, next_action_date?, notes? | Appends a follow-up row, updates case status/next action in one transaction (`record_followup()`). A next action date (today or later) is required except for outcome `Cancelled`, which closes the case. Rows are never edited or deleted afterwards. Owner and front desk. |
| `listRenewalsDue` | stage | Pipeline grouped by reminder stage with expected amounts. |
| `listPendingPayments` | — | The verification queue: member, purpose, amount, member-claimed reference. |
| `verifyPayment` | payment_id, decision: verify/reject, provider_ref | **The most sensitive action in the system.** One transaction: payment `Pending → Paid` (or Failed on reject), membership extension or add-on activation, receipt, audit row. Verifying an already-Paid payment returns `ALREADY_VERIFIED` and changes nothing. Owner role only. |
| `refundPayment` | payment_id, reason | Marks payment Refunded and records the reversal as a new audit/membership adjustment entry — the original Paid record is not rewritten silently. Owner only. |
| `upsertPlan` / `setPlanActive` | plan fields | Price changes affect future orders only; existing orders keep their snapshot amounts. |
| `upsertAddon` / `adjustStock` / `recordPTSession` | addon fields / order_id | Stock can never go negative; PT session recording fails if `sessions_used = sessions_total`. |
| `updateSettings` | gym profile, threshold, timings, defaults | Owner only. Threshold changes apply from the next scan. |

## WhatsApp deep links (no server call)

Red List and member rows render `https://wa.me/91<phone>?text=<url-encoded template>` links. Templates (service messages only; marketing requires consent):

- **No-show care:** `Hi {{name}}, your last gym check-in was on {{last_visit}}. Is everything okay? If you need a timing change, a pause, or trainer help, reply here: {{support_link}}`
- **Renewal reminder:** `Hi {{name}}, your {{plan}} membership expires on {{expiry_date}}. Review plans and the final payable amount here: {{renewal_link}}`
- **Payment success:** `Payment of ₹{{amount}} received. Your membership is active till {{new_expiry}}. Receipt: {{receipt_link}}`
- **Payment failed:** `Your payment did not complete. If any amount was debited, please wait for the provider status to update. Retry: {{payment_link}} | Help: {{support_link}}`
- **Weekly goal:** `Great work, {{name}}! You completed {{completed}}/{{target}} planned visits this week. Next planned visit: {{next_visit}}.`
- **PT reminder:** `Your PT session is on {{date}} at {{time}} with {{trainer}}. Reschedule: {{session_link}}`

## Rate and abuse notes

- `checkIn` with an invalid token is rate-limited per member/IP at the platform layer; repeated invalid tokens are logged.
- Login attempts are throttled by Supabase Auth (staff) and a simple attempt counter + lockout note for member PIN login (see `SECURITY.md`).

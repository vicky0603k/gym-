# Requirements — Gym Retention System

## Introduction
A single-gym, mobile-first PWA (Next.js + Supabase) that records QR attendance, detects members absent 10+ days onto a Red List for staff follow-up, collects renewals on time, and sells PT/diet/supplement add-ons. Roles: Member, Owner/Manager, Front-desk staff.

## Requirements

### 1. Member access
**User story:** As a member, I want to open the app from my phone without installing from a store, so I can check in quickly.
- WHEN a member opens the member link THEN the system SHALL be installable as a PWA and usable fully in the browser.
- WHEN a member logs in with phone number + 4-digit PIN THEN the system SHALL show only that member's data.
- IF login fails THEN the system SHALL show a clear error without revealing whether the phone number exists.

### 2. QR check-in
**User story:** As a member, I want to scan the gym's QR to record attendance in seconds.
- WHEN a member scans a valid gate QR and has an Active membership THEN the system SHALL save attendance with timestamp (Asia/Kolkata) and show success + updated weekly goal.
- The gate QR token SHALL rotate every 45 seconds and be HMAC-signed; IF a token is expired or invalid THEN the system SHALL reject the scan with a clear message.
- IF the member already checked in within 3 hours THEN the system SHALL reject it as a duplicate and SHALL NOT create a second attendance record.
- IF the membership is Expired THEN the system SHALL reject check-in and show the renewal option.
- WHEN front-desk does an assisted check-in THEN the system SHALL require staff identity and a reason, recorded in the audit log.

### 3. Weekly goal / streak
**User story:** As a member, I want to see my weekly progress without being punished for rest days.
- The system SHALL track a weekly goal (visits per week, configurable per member, default 4).
- Rest days and approved pauses SHALL NOT count against the goal.
- WHEN a member opens home THEN the system SHALL show this week's completed/target visits, current plan and exact expiry date.

### 4. No-show Red List
**User story:** As an owner, I want a daily list of members who have silently stopped coming, so my staff can call them before they quit.
- WHEN the daily scan runs THEN the system SHALL open a no-show case for every Active member whose last valid check-in is ≥ threshold days ago (default 10, configurable).
- The system SHALL exclude Paused, Frozen, Expired and Cancelled members, and SHALL never create a second open case for the same member.
- Each row SHALL show name, phone, plan, expiry, last visit, absent days, assigned trainer, last follow-up, with Call, WhatsApp (wa.me link) and Mark Outcome actions.
- WHEN staff marks an outcome (Will return / Injured / Travelling / Timing issue / Unhappy / No response / Cancelled) THEN the system SHALL save it with staff, timestamp and next action date where required, and SHALL NOT allow deleting follow-up history.
- WHEN a red-listed member completes a valid check-in THEN the system SHALL auto-resolve the open case as Returned, keeping history.

### 5. Renewal and payments
**User story:** As a member, I want to renew before expiry without visiting the desk.
- WHEN a membership is within 7 days of expiry THEN the system SHALL surface renewal on the member home and in the owner's Renewals Due list; reminders are staged at 7 days, 3 days, expiry day, +3 days.
- The renewal screen SHALL show plan options (3/6/12 months where configured), base price, discount and final payable amount, plus terms.
- Payment states SHALL be Created, Pending, Paid, Failed, Refunded.
- The system SHALL extend the membership ONLY when a payment becomes Paid (MVP: owner manual verification; later: verified gateway webhook), and verification SHALL be idempotent — verifying twice extends once.
- WHEN payment becomes Paid THEN the system SHALL show a receipt with amount and new expiry date.

### 6. Add-ons
**User story:** As a member, I want to see PT, diet and product offers clearly, without pressure.
- Add-on cards SHALL show name, outcome, price, duration/validity, sessions or stock, trainer/qualification where relevant, inclusions/exclusions and cancellation terms.
- Add-ons SHALL never be pre-selected. IF stock is 0 or trainer is unavailable THEN purchase SHALL be blocked with a clear message.
- WHEN an add-on is purchased and paid THEN the owner SHALL see the order, and PT usage SHALL be trackable session by session; stock/usage SHALL never go negative.

### 7. Owner dashboard
**User story:** As an owner, I want today's action list, not decorative reports.
- The dashboard SHALL show: active members, today's check-ins, 7-day active members, open no-show cases, renewals due in 7 days with expected amount, renewal collection this month, add-on revenue this month, follow-ups due today.
- Every count SHALL match the underlying records (no cached fake numbers).

### 8. Settings, consent, audit
- Owner SHALL be able to configure gym profile, no-show threshold, weekly goal default, renewal reminder timing and plans/prices.
- Marketing and service communications SHALL be separate; a member SHALL be able to opt out of marketing messages.
- Attendance corrections, payment changes and follow-ups SHALL be written to an audit log with actor and timestamp, and SHALL NOT be deletable.

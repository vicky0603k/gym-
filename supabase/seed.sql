-- ═══════════════════════════════════════════════════════════════════════════
-- Seed data — Gym Retention PWA
--
-- Run AFTER migrations 001, 002, 003.
-- All PINs are 1234 (demo only — never use in production).
-- Staff auth users must be created in Supabase Auth first, then their UUIDs
-- must match the staff_users.id values below. Demo credentials:
--   Owner:      owner@gym.demo   / DemoOwner123!
--   FrontDesk:  desk@gym.demo     / DemoDesk123!
--
-- Dataset summary:
--   30 members (status mix), 3 trainers, 4 plans, 3 add-ons
--   6 members absent 10–20 days (Red List candidates)
--   5 memberships expiring within 7 days
--   Realistic attendance history for weekly-goal testing
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Settings (single row) ─────────────────────────────────────────────────
insert into settings (id, gym_name, address, phone, timezone, no_show_threshold_days, qr_rotation_seconds, duplicate_window_hours, renewal_windows, weekly_goal_default)
values (
  '00000000-0000-0000-0000-000000000001',
  'FitLife Gym',
  '12 MG Road, Indiranagar, Bengaluru, KA 560038',
  '+91 90000 00000',
  'Asia/Kolkata',
  10, 45, 3,
  '{14,7,3,0,-3}',
  4
);

-- ─── Trainers ──────────────────────────────────────────────────────────────
insert into trainers (id, name, phone, specialisation, is_active) values
  ('a0000000-0000-0000-0000-000000000001', 'Rahul Sharma', '9000010001', 'Strength & Powerlifting', true),
  ('a0000000-0000-0000-0000-000000000002', 'Priya Singh',  '9000010002', 'Diet & Cardio',           true),
  ('a0000000-0000-0000-0000-000000000003', 'Amit Kumar',   '9000010003', 'Functional Training',     true);

-- ─── Staff users ───────────────────────────────────────────────────────────
-- NOTE: Create these users in Supabase Auth first (email + password), then
-- update the id values to match the auth.users.id. For local dev, you can
-- also insert directly into auth.users via the SQL editor.
insert into staff_users (id, name, role) values
  ('b0000000-0000-0000-0000-000000000001', 'Gym Owner',  'Owner'),
  ('b0000000-0000-0000-0000-000000000002', 'Desk Staff', 'FrontDesk');

-- ─── Plans ─────────────────────────────────────────────────────────────────
insert into plans (id, name, duration_days, price, discount_pct, benefits, is_active) values
  ('c0000000-0000-0000-0000-000000000001', 'Monthly',     30,  1000, 0,  'Full gym access, group classes', true),
  ('c0000000-0000-0000-0000-000000000002', 'Quarterly',   90,  2500, 10, 'Full gym access, group classes, 1 PT session', true),
  ('c0000000-0000-0000-0000-000000000003', 'Half-yearly', 180, 4500, 15, 'Full gym access, group classes, 3 PT sessions', true),
  ('c0000000-0000-0000-0000-000000000004', 'Yearly',      365, 8000, 20, 'Full gym access, group classes, 6 PT sessions, diet consultation', true);

-- ─── Add-ons ───────────────────────────────────────────────────────────────
insert into addons (id, type, title, description, price, validity_days, sessions, stock, trainer_id, is_active) values
  ('d0000000-0000-0000-0000-000000000001', 'PT',      'Personal Training 12 Sessions', '12 one-on-one PT sessions with a certified trainer.', 8000, 90,  12,   null, 'a0000000-0000-0000-0000-000000000001', true),
  ('d0000000-0000-0000-0000-000000000002', 'Diet',    'Diet Plan 30 Days',             'Personalised diet plan for 30 days. Includes 1 consultation.', 1999, 30, null, null, 'a0000000-0000-0000-0000-000000000002', true),
  ('d0000000-0000-0000-0000-000000000003', 'Product', 'Whey Protein 1kg',               '1kg whey protein powder. Pick up at the front desk.',       2499, 365, null, 25,  null,                                   true);

-- ─── Members (30) ──────────────────────────────────────────────────────────
-- All PINs are 1234 (hashed with sha256 for the demo).
-- PIN hash = encode(digest('1234', 'sha256'), 'hex')

insert into members (id, name, phone, pin_hash, status, assigned_trainer_id, weekly_target, join_date, marketing_consent) values
  -- Members 1-6: will be Red List candidates (absent 10-20 days)
  ('e0000000-0000-0000-0000-000000000001', 'Aarav Sharma',   '9000020001', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '120 days', true),
  ('e0000000-0000-0000-0000-000000000002', 'Vivaan Patel',    '9000020002', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000001', 5, current_date - interval '90 days',  true),
  ('e0000000-0000-0000-0000-000000000003', 'Aditya Kumar',    '9000020003', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 3, current_date - interval '180 days', true),
  ('e0000000-0000-0000-0000-000000000004', 'Vihaan Gupta',    '9000020004', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000003', 4, current_date - interval '60 days',  true),
  ('e0000000-0000-0000-0000-000000000005', 'Arjun Mehta',     '9000020005', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '200 days', true),
  ('e0000000-0000-0000-0000-000000000006', 'Sai Reddy',      '9000020006', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000001', 4, current_date - interval '150 days', true),

  -- Members 7-11: memberships expiring within 7 days
  ('e0000000-0000-0000-0000-000000000007', 'Reyansh Singh',  '9000020007', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '30 days',  true),
  ('e0000000-0000-0000-0000-000000000008', 'Ayaan Khan',     '9000020008', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '30 days',  false),
  ('e0000000-0000-0000-0000-000000000009', 'Krish Verma',    '9000020009', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000002', 5, current_date - interval '30 days',  true),
  ('e0000000-0000-0000-0000-000000000010', 'Ishaan Nair',    '9000020010', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 3, current_date - interval '30 days',  true),
  ('e0000000-0000-0000-0000-000000000011', 'Ananya Das',     '9000020011', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '30 days',  true),

  -- Members 12-20: regular active members
  ('e0000000-0000-0000-0000-000000000012', 'Diya Iyer',      '9000020012', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000003', 4, current_date - interval '75 days',  true),
  ('e0000000-0000-0000-0000-000000000013', 'Saanvi Rao',     '9000020013', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '45 days',  true),
  ('e0000000-0000-0000-0000-000000000014', 'Aadhya Joshi',   '9000020014', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 3, current_date - interval '100 days', true),
  ('e0000000-0000-0000-0000-000000000015', 'Pari Malhotra',  '9000020015', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000002', 5, current_date - interval '60 days',  true),
  ('e0000000-0000-0000-0000-000000000016', 'Myra Agarwal',   '9000020016', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '50 days',  true),
  ('e0000000-0000-0000-0000-000000000017', 'Anika Bose',     '9000020017', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '90 days',  true),
  ('e0000000-0000-0000-0000-000000000018', 'Navya Pillai',   '9000020018', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 3, current_date - interval '40 days',  true),
  ('e0000000-0000-0000-0000-000000000019', 'Riya Chauhan',   '9000020019', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000001', 4, current_date - interval '70 days',  true),
  ('e0000000-0000-0000-0000-000000000020', 'Kavya Deshmukh','9000020020', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '55 days',  true),

  -- Members 21-25: paused members (must NOT appear on Red List)
  ('e0000000-0000-0000-0000-000000000021', 'Rohan Kapoor',   '9000020021', encode(digest('1234', 'sha256'), 'hex'), 'Paused', null, 4, current_date - interval '180 days', true),
  ('e0000000-0000-0000-0000-000000000022', 'Karan Bhatia',    '9000020022', encode(digest('1234', 'sha256'), 'hex'), 'Paused', null, 4, current_date - interval '120 days', true),
  ('e0000000-0000-0000-0000-000000000023', 'Nikhil Jain',     '9000020023', encode(digest('1234', 'sha256'), 'hex'), 'Paused', null, 4, current_date - interval '90 days',  true),

  -- Members 24-25: expired members
  ('e0000000-0000-0000-0000-000000000024', 'Tanish Saxena',   '9000020024', encode(digest('1234', 'sha256'), 'hex'), 'Expired', null, 4, current_date - interval '365 days', true),
  ('e0000000-0000-0000-0000-000000000025', 'Dhruv Mishra',    '9000020025', encode(digest('1234', 'sha256'), 'hex'), 'Expired', null, 4, current_date - interval '400 days', true),

  -- Members 26-30: more active members
  ('e0000000-0000-0000-0000-000000000026', 'Arnav Pandey',    '9000020026', encode(digest('1234', 'sha256'), 'hex'), 'Active', 'a0000000-0000-0000-0000-000000000003', 4, current_date - interval '80 days',  true),
  ('e0000000-0000-0000-0000-000000000027', 'Yuvaraj Shetty',  '9000020027', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '65 days',  true),
  ('e0000000-0000-0000-0000-000000000028', 'Dev Chaudhary',   '9000020028', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 3, current_date - interval '35 days',  true),
  ('e0000000-0000-0000-0000-000000000029', 'Kabir Thakur',    '9000020029', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '110 days', true),
  ('e0000000-0000-0000-0000-000000000030', 'Aryan Sehgal',    '9000020030', encode(digest('1234', 'sha256'), 'hex'), 'Active', null, 4, current_date - interval '25 days',  true);

-- ─── Memberships ──────────────────────────────────────────────────────────
-- Members 1-6: active, long expiry (Red List candidates — absent but not expired)
insert into memberships (member_id, plan_id, start_date, expiry_date, status, renewal_source)
select id, 'c0000000-0000-0000-0000-000000000003', current_date - interval '120 days',
        current_date + interval '60 days', 'Active', 'Pilot import'
from members where id in (
  'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
  'e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000006'
);

-- Members 7-11: active, expiring within 7 days (renewal pipeline)
insert into memberships (member_id, plan_id, start_date, expiry_date, status, renewal_source)
values
  ('e0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', current_date - 27, current_date + 2, 'Active', 'Desk'),
  ('e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', current_date - 28, current_date + 4, 'Active', 'Desk'),
  ('e0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', current_date - 25, current_date + 5, 'Active', 'Desk'),
  ('e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', current_date - 23, current_date + 7, 'Active', 'Desk'),
  ('e0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', current_date - 86, current_date + 4, 'Active', 'Desk');

-- Members 12-20: active, various expiry
insert into memberships (member_id, plan_id, start_date, expiry_date, status, renewal_source)
select id, 'c0000000-0000-0000-0000-000000000003',
        current_date - interval '60 days',
        current_date + interval '120 days', 'Active', 'Desk'
from members where id in (
  'e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000013',
  'e0000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000015',
  'e0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000017',
  'e0000000-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000019',
  'e0000000-0000-0000-0000-000000000020'
);

-- Members 21-23: frozen (paused — must NOT appear on Red List)
insert into memberships (member_id, plan_id, start_date, expiry_date, status, freeze_start, freeze_end, renewal_source)
values
  ('e0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000003', current_date - 150, current_date + 30,  'Frozen', current_date - 15, current_date + 15, 'Desk'),
  ('e0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000002', current_date - 80,  current_date + 10,  'Frozen', current_date - 10, current_date + 20, 'Desk'),
  ('e0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000001', current_date - 20,  current_date + 10,  'Frozen', current_date - 5,  current_date + 25, 'Desk');

-- Members 24-25: expired
insert into memberships (member_id, plan_id, start_date, expiry_date, status, renewal_source)
values
  ('e0000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000001', current_date - 365, current_date - 5, 'Expired', 'Desk'),
  ('e0000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000001', current_date - 395, current_date - 30, 'Expired', 'Desk');

-- Members 26-30: active, long expiry
insert into memberships (member_id, plan_id, start_date, expiry_date, status, renewal_source)
select id, 'c0000000-0000-0000-0000-000000000004',
        current_date - interval '60 days',
        current_date + interval '300 days', 'Active', 'Desk'
from members where id in (
  'e0000000-0000-0000-0000-000000000026', 'e0000000-0000-0000-0000-000000000027',
  'e0000000-0000-0000-0000-000000000028', 'e0000000-0000-0000-0000-000000000029',
  'e0000000-0000-0000-0000-000000000030'
);

-- ─── Attendance ────────────────────────────────────────────────────────────
-- Members 1-6: last check-in 10-20 days ago (Red List candidates).
-- Member 1: absent 12 days; Member 2: absent 14; Member 3: absent 16;
-- Member 4: absent 18; Member 5: absent 20; Member 6: absent 15.
insert into attendance (member_id, checkin_at, source)
values
  ('e0000000-0000-0000-0000-000000000001', now() - interval '12 days', 'QR'),
  ('e0000000-0000-0000-0000-000000000002', now() - interval '14 days', 'QR'),
  ('e0000000-0000-0000-0000-000000000003', now() - interval '16 days', 'QR'),
  ('e0000000-0000-0000-0000-000000000004', now() - interval '18 days', 'QR'),
  ('e0000000-0000-0000-0000-000000000005', now() - interval '20 days', 'QR'),
  ('e0000000-0000-0000-0000-000000000006', now() - interval '15 days', 'QR');

-- Earlier attendance for members 1-6 (so they have history)
insert into attendance (member_id, checkin_at, source)
select m.id, now() - (d * interval '1 day') - interval '5 hours', 'QR'
from members m
cross join generate_series(18, 35) as d
where m.id in (
  'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
  'e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000006'
)
and d % 2 = 0;  -- every other day for variety

-- Members 7-11: recent attendance (they still come, but memberships expiring)
insert into attendance (member_id, checkin_at, source)
select m.id, now() - (d * interval '1 day') - interval '3 hours', 'QR'
from members m
cross join generate_series(0, 14) as d
where m.id in (
  'e0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000008',
  'e0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000010',
  'e0000000-0000-0000-0000-000000000011'
)
and d % 2 = 0;

-- Members 12-20: regular attendance (every other day for the last 2 weeks)
insert into attendance (member_id, checkin_at, source)
select m.id, now() - (d * interval '1 day') - interval '4 hours', 'QR'
from members m
cross join generate_series(0, 14) as d
where m.id in (
  'e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000013',
  'e0000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000015',
  'e0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000017',
  'e0000000-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000019',
  'e0000000-0000-0000-0000-000000000020'
)
and d % 2 = 0;

-- Members 21-23: old attendance (before freeze, 20+ days ago)
insert into attendance (member_id, checkin_at, source)
select m.id, now() - (d * interval '1 day') - interval '2 hours', 'QR'
from members m
cross join generate_series(20, 40) as d
where m.id in (
  'e0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000022',
  'e0000000-0000-0000-0000-000000000023'
)
and d % 3 = 0;

-- Members 26-30: regular attendance
insert into attendance (member_id, checkin_at, source)
select m.id, now() - (d * interval '1 day') - interval '6 hours', 'QR'
from members m
cross join generate_series(0, 10) as d
where m.id in (
  'e0000000-0000-0000-0000-000000000026', 'e0000000-0000-0000-0000-000000000027',
  'e0000000-0000-0000-0000-000000000028', 'e0000000-0000-0000-0000-000000000029',
  'e0000000-0000-0000-0000-000000000030'
)
and d % 2 = 0;

-- ─── Audit log entry for the seed run ─────────────────────────────────────
insert into audit_logs (actor_type, actor_id, action, record_type, record_id, summary)
values (
  'Staff',
  'b0000000-0000-0000-0000-000000000001',
  'system.seed',
  'settings',
  '00000000-0000-0000-0000-000000000001',
  'Seed data loaded: 30 members, 3 trainers, 2 staff, 4 plans, 3 add-ons.'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Demo credentials summary (for local development only — never production):
--
--   Members: phone 9000020001–9000020030, PIN 1234
--   Owner:   owner@gym.demo  / DemoOwner123!  (create in Supabase Auth)
--   FrontDesk: desk@gym.demo / DemoDesk123!  (create in Supabase Auth)
-- ═══════════════════════════════════════════════════════════════════════════

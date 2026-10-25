# DEPLOYMENT — Gym Retention PWA

How the app is deployed for the pilot, and how updates are shipped. Stack: Vercel (app) + Supabase (database/auth). See `TECH_STACK.md` and `SECURITY.md` before deploying.

## 1. Accounts needed

- GitHub (code repository).
- Vercel (free tier is enough for the pilot).
- Supabase (free tier, one project for production; a second free project is recommended for dev/testing so real member data is never used while testing).

## 2. Supabase setup (production)

1. Create the project; note the project URL and keys.
2. In the SQL editor (or via the Supabase CLI), run **every** migration in order, one file at a time: `001_tables.sql` … `012_desk_refund_freeze_staff.sql`. Run each file once; a second run fails with "already exists" and changes nothing.
3. **Do not run `seed.sql` in production**, except: create the real owner account (Supabase Auth user + `staff_users` row) and the gym's real `settings` row and plans.
4. Confirm RLS is enabled on every table (Table Editor → table → RLS) and run the member-isolation check from `TESTING.md` against a test member before real members are imported.
5. Import the gym's real members only after the owner has verified the list (count must match the gym's source record — register/app export): `node scripts/import-members.mjs members.csv` (dry run), then `--commit`. The PIN list it writes to `private/` is for handing PINs over in person — never share or commit it.
6. Add front-desk logins from Owner → Settings → Staff logins (no SQL needed after the first owner).

## 3. Vercel setup

1. Import the GitHub repository; framework preset: Next.js. Build command `npm run build`, no custom output settings.
2. Set environment variables (Production environment):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `QR_TOKEN_SECRET` (long random string, generate fresh for production)
   - `CRON_SECRET` (long random string)
3. Add the cron job in `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/daily", "schedule": "30 1 * * *" }] }
   ```
   (01:30 UTC = 07:00 IST — adjust so the Red List is fresh before the gym's morning shift. Note Vercel cron schedules are in UTC.)
4. Deploy. Note the production URL (`https://<project>.vercel.app` or a custom domain — see §5).

## 4. Post-deploy smoke tests (every production deploy)

Run on the production URL, on a real phone:
- [ ] Landing page loads; gym name/logo correct
- [ ] Owner login works; dashboard numbers load
- [ ] Test member login works; home shows plan and expiry
- [ ] QR display screen shows a rotating QR; a test scan completes a check-in
- [ ] PWA install: "Add to Home Screen" works on Android Chrome; icon and splash look right
- [ ] Offline page appears in airplane mode (no crash/blank screen)
- [ ] Cron: call `/api/cron/daily` without the secret → rejected; with the secret → succeeds with sane counts

If any smoke test fails, roll back (Vercel → Deployments → previous deployment → Promote) before debugging — the gym must never be left on a broken build during working hours.

## 5. Custom domain (recommended before the pilot starts)

A short, gym-branded domain makes the member link and QR standee trustworthy (example: `app.<gymname>.in`). Add it in Vercel → Domains, set the DNS records it shows, and update any printed QR/links. Using only the `vercel.app` URL works, but a real domain is strongly preferred for a paying client.

## 6. Go-live checklist (pilot day)

- [ ] Gym profile confirmed: name, logo, address, hours, timezone in `settings`
- [ ] Plans, prices, discounts and freeze rules match the owner's written confirmation
- [ ] Member import count matches the gym's source record; expiry dates spot-checked for 10 random members
- [ ] Front-desk staff trained: QR display, assisted check-in, follow-up entry (see `TESTING.md` UAT)
- [ ] Owner trained: Red List, payment verification, renewals due
- [ ] Gate QR display device/standee in place; **no static check-in QR printed anywhere**
- [ ] Failure checklist (`TESTING.md`) passed on production with test data, then test data removed
- [ ] Backup: Supabase point-in-time/backup status checked; database export downloaded once before go-live

## 7. Updates and operations

- Ship updates via git push → Vercel auto-deploys. Prefer deploying in the gym's off-hours; run the §4 smoke tests after every deploy.
- Database changes are always new numbered migration files — never edit a migration that has already run in production.
- Monitor weekly during the pilot: Vercel deployment status, Supabase usage (free-tier limits), cron run results, and the data-quality alerts (Paid without reference, negative stock).
- Backups: rely on Supabase backups plus `npm run backup` weekly during the pilot month (every business table to `backups/<date>/*.csv`, PIN hashes excluded; keep the folder private).

## 8. Rollback and recovery

- App rollback: Vercel one-click promote of the previous deployment (§4).
- Data mistakes: correct through the app's own flows (which write audit entries) — never hand-edit production financial or attendance rows in the SQL editor except in a genuine emergency, and record any such fix in `docs/decisions.md` with date and reason.
- If Supabase/Vercel is down: the gym falls back to the paper register for that day, and staff add those visits afterwards from the member's page → **Add missed visit** (date, time, reason; audited).

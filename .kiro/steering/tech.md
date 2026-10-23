# Tech

- **Framework:** Next.js (App Router), TypeScript strict, Tailwind CSS
- **Backend:** Supabase — Postgres, Auth, Row Level Security enabled on every table, schema changes only via migrations in `supabase/migrations/`
- **PWA:** Serwist (`@serwist/next`), manifest via `app/manifest.ts`, icons in `public/icons/`
- **QR:** `qrcode` for generating the rotating gate QR; `html5-qrcode` for in-browser scanning
- **Validation:** Zod on all forms and server actions
- **Dates:** `date-fns` + `date-fns-tz`; ALL business dates (expiry, absent days, weekly goal) computed in `Asia/Kolkata`
- **Payments (MVP):** Manual UPI + owner verification. States: Created, Pending, Paid, Failed, Refunded. Designed so a Razorpay webhook can set Paid later — verification must be idempotent
- **QR security:** token = HMAC-signed payload (gym id + timestamp) using env secret, rotates every 45 seconds, server rejects expired/invalid tokens and duplicate check-ins within 3 hours
- **Commands:** `npm run dev` · `npm run build` (must pass to finish any task) · `npm run lint`
- **Deploy:** Vercel + Supabase free tier. Secrets only in `.env.local`, never committed.

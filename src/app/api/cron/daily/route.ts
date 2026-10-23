import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runDailyScan } from "@/services/red-list";

const NO_STORE = { "Cache-Control": "no-store" };

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/cron/daily
 * Runs the daily no-show scan (Red List). Vercel Cron calls it at 07:00 IST (vercel.json).
 *
 * Auth: Authorization: Bearer <CRON_SECRET> only.
 * Idempotent: a second run on the same day creates no duplicate cases.
 *
 * Response: { cases_opened, followups_due } counts for logging.
 */
export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const result = await runDailyScan();
    return NextResponse.json(
      { cases_opened: result.casesOpened, followups_due: result.followupsDue },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json({ error: "Daily scan failed" }, { status: 500, headers: NO_STORE });
  }
}

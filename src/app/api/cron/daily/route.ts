import { NextResponse } from "next/server";
import { runDailyScan } from "@/services/red-list";

/**
 * GET /api/cron/daily
 * Runs the daily scan (Red List) and builds renewal reminder lists.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> only (Vercel Cron).
 * Idempotent: a second run on the same day creates no duplicate cases.
 *
 * Response: { cases_opened } counts for logging.
 */
export async function GET(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await runDailyScan();
    return NextResponse.json({
      cases_opened: result.casesOpened,
      reminders_created: 0, // reminders built in Module 8
      followups_due: 0, // follow-ups built in Module 5
    });
  } catch {
    return NextResponse.json(
      { error: "Daily scan failed" },
      { status: 500 }
    );
  }
}

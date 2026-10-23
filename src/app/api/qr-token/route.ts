import { NextResponse } from "next/server";
import { generateQrToken } from "@/services/qr";
import { getCurrentStaff } from "@/services/auth";
import { QR_ROTATION_SECONDS } from "@/utils/constants";

// A token must never be served from any cache (see also sw.ts NetworkOnly rule).
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/qr-token
 * Returns the current gate QR payload for the owner's display screen.
 * Auth: Owner or FrontDesk session only. Members and anonymous callers get 401.
 *
 * Response: { token, gym_id, expires_in_seconds, rotation_seconds }
 */
export async function GET() {
  if (!(await getCurrentStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const { token, expiresInSeconds } = generateQrToken();
    return NextResponse.json(
      {
        token,
        gym_id: "default",
        expires_in_seconds: expiresInSeconds,
        rotation_seconds: QR_ROTATION_SECONDS,
      },
      { headers: NO_STORE }
    );
  } catch {
    // QR_TOKEN_SECRET not set or other error — don't leak details
    return NextResponse.json(
      { error: "QR token generation failed" },
      { status: 500, headers: NO_STORE }
    );
  }
}

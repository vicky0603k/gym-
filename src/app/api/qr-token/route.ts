import { NextResponse } from "next/server";
import { generateQrToken } from "@/services/qr";
import { getCurrentStaff } from "@/services/auth";

/**
 * GET /api/qr-token
 * Returns the current gate QR payload for the owner's display screen.
 * Auth: Owner or FrontDesk session only. Members and anonymous callers get 401.
 *
 * Response: { token, gym_id, expires_in_seconds }
 */
export async function GET() {
  if (!(await getCurrentStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, expiresInSeconds } = generateQrToken();
    return NextResponse.json({
      token,
      gym_id: "default",
      expires_in_seconds: expiresInSeconds,
    });
  } catch {
    // QR_TOKEN_SECRET not set or other error — don't leak details
    return NextResponse.json(
      { error: "QR token generation failed" },
      { status: 500 }
    );
  }
}

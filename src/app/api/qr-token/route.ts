import { NextResponse } from "next/server";
import { generateQrToken } from "@/services/qr";

/**
 * GET /api/qr-token
 * Returns the current gate QR payload for the owner's display screen.
 * Auth: owner/staff session only (enforced by middleware + caller checks).
 *
 * Response: { token, gym_id, expires_in_seconds }
 */
export async function GET() {
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

/**
 * QR token generation and verification.
 *
 * Token format: base64url(payload).signature
 * payload = { gym: <gym_id>, step: <time_step> }
 * signature = HMAC-SHA256(secret, payload_string)
 *
 * Rotation: one time step = QR_ROTATION_SECONDS seconds.
 * Server accepts the current step and one previous step (tolerance).
 */
import { createHmac } from "crypto";
import {
  QR_ROTATION_SECONDS,
  QR_TOLERANCE_STEPS,
} from "@/utils/constants";

const GYM_ID = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "gym"; // stable identifier

function getSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret) throw new Error("QR_TOKEN_SECRET is not set");
  return secret;
}

function currentTimeStep(): number {
  return Math.floor(Date.now() / 1000 / QR_ROTATION_SECONDS);
}

function buildPayload(gymId: string, step: number): string {
  return Buffer.from(JSON.stringify({ gym: gymId, step })).toString(
    "base64url"
  );
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Generate the current gate QR token string */
export function generateQrToken(): {
  token: string;
  expiresInSeconds: number;
} {
  const step = currentTimeStep();
  const payload = buildPayload(GYM_ID, step);
  const signature = sign(payload, getSecret());
  const token = `${payload}.${signature}`;

  // Seconds remaining in this step
  const elapsed = (Date.now() / 1000) % QR_ROTATION_SECONDS;
  const expiresInSeconds = Math.ceil(QR_ROTATION_SECONDS - elapsed);

  return { token, expiresInSeconds };
}

/** Verify a token string. Returns the time step on success or throws. */
export function verifyQrToken(token: string): { step: number } {
  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("QR_INVALID");
  }
  const [payload, receivedSig] = parts;

  // Verify signature
  const expectedSig = sign(payload, secret);
  // Constant-time comparison to prevent timing attacks
  if (receivedSig.length !== expectedSig.length) {
    throw new Error("QR_INVALID");
  }
  const a = Buffer.from(receivedSig);
  const b = Buffer.from(expectedSig);
  if (!a.equals(b)) {
    throw new Error("QR_INVALID");
  }

  // Decode payload
  let parsed: { gym: string; step: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new Error("QR_INVALID");
  }

  // Check time window: accept current step and up to TOLERANCE steps back
  const currentStep = currentTimeStep();
  const diff = currentStep - parsed.step;
  if (diff < 0 || diff > QR_TOLERANCE_STEPS) {
    throw new Error("QR_EXPIRED");
  }

  return { step: parsed.step };
}

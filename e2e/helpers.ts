import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const AUTH = path.join(__dirname, ".auth");
export const SHOTS = path.join(__dirname, "..", "test-results", "shots");

type Login = { email: string; password: string; id: string };
export function credentials(): { owner: Login; desk: Login } {
  const file = path.join(AUTH, "credentials.json");
  if (!fs.existsSync(file)) throw new Error("Run `node scripts/create-e2e-staff.mjs` first (test project only).");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function env(key: string): string {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const value = text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
  if (!value) throw new Error(`${key} missing in .env.local`);
  return value;
}

/** Service client for test set-up only (backdating visits). Never used to assert UI results. */
export function admin() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

/** Unique 10-digit Indian mobile for this run. */
export function uniquePhone(): string {
  return `7${String(Date.now()).slice(-9)}`;
}

/** Full-page screenshot into test-results/shots, plus the 375px no-sideways-scroll check. */
export async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: page scrolls sideways at ${page.viewportSize()?.width}px`).toBeLessThanOrEqual(1);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

/** Collects console errors and failed requests so every test can assert none happened. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errors;
}

/**
 * A Y4M video showing one QR code, for Chrome's fake camera
 * (--use-file-for-fake-video-capture). 4:2:0, white background, 8px modules.
 */
export function writeQrVideo(text: string, file: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  // A normal 640×480 camera frame; the code fills about half the height so it sits
  // well inside the scanner's box (70% of the shorter side).
  const W = 640;
  const H = 480;
  const n = modules.size;
  const scale = Math.max(2, Math.floor(240 / n));
  const left = Math.floor((W - n * scale) / 2);
  const top = Math.floor((H - n * scale) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (modules.get(r, c))
        for (let dy = 0; dy < scale; dy++) {
          const row = (top + r * scale + dy) * W;
          y.fill(16, row + left + c * scale, row + left + (c + 1) * scale);
        }
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma]);
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame, frame]));
}

export async function memberLogin(page: Page, phone: string, pin: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Member", exact: true }).click();
  await page.getByLabel(/mobile number/i).fill(phone);
  await page.getByLabel(/PIN/i).fill(pin);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/member");
}

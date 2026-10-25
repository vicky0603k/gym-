import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end pilot journey (PHASE_PLAN.md Phase 12) on a phone-sized screen.
 * Runs against the TEST Supabase project in .env.local — it creates its own
 * members and payments. First time: `node scripts/create-e2e-staff.mjs`.
 *
 *   npm run test:e2e            # starts the app on :3100 if it isn't running
 *   E2E_BASE_URL=https://… npm run test:e2e   # against a deployed test build
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } },
    {
      name: "mobile",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next dev -p 3100", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});

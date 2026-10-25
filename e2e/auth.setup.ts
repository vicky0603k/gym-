import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { AUTH, credentials } from "./helpers";

// Logs the e2e owner and front-desk accounts in through the real login screen once,
// and saves their sessions for the journey tests.
for (const role of ["owner", "desk"] as const) {
  setup(`log in as ${role}`, async ({ page }) => {
    const login = credentials()[role];
    await page.goto("/login");
    await page.getByRole("button", { name: "Owner / Staff" }).click();
    await page.getByLabel("Email").fill(login.email);
    await page.getByLabel("Password").fill(login.password);
    await page.getByRole("button", { name: "Log in to dashboard" }).click();
    await page.waitForURL("**/owner");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.context().storageState({ path: path.join(AUTH, `${role}.json`) });
  });
}

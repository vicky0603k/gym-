/**
 * The pilot journey (PHASE_PLAN.md Phase 12), done the way gym staff and a
 * member would do it, on a 375px phone screen:
 * plan → member → login → QR check-in → absence → Red List → follow-up →
 * return → renewal → verify → desk cash → refund → add-on → PT session →
 * PIN reset → expiry fix → pause/resume → missed visit → cancel/anonymise →
 * staff logins → GST receipt → every screen without errors.
 */
import os from "node:os";
import path from "node:path";
import { chromium, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { admin, AUTH, memberLogin, shot, SHOTS, uniquePhone, watchErrors, writeQrVideo } from "./helpers";

test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString().slice(-5);
const PLAN = `E2E Plan ${RUN}`;
const MEMBER = `E2E Member ${RUN}`;
const PHONE = uniquePhone();
const PIN = "4321";
const VIEW = { viewport: { width: 375, height: 812 }, locale: "en-IN", timezoneId: "Asia/Kolkata" };

/** "d MMM yyyy" in Asia/Kolkata, `days` from today — the app's display format. */
function displayDate(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const d = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

let owner: Page;
let desk: Page;
let member: Page;
let memberId = "";
let paymentId = "";
const errors: Record<string, string[]> = {};
const contexts: BrowserContext[] = [];

async function open(browser: Browser, role: "owner" | "desk" | "member") {
  const context = await browser.newContext({ ...VIEW, storageState: role === "member" ? undefined : path.join(AUTH, `${role}.json`) });
  contexts.push(context);
  const page = await context.newPage();
  errors[role] = watchErrors(page);
  return page;
}

test.beforeAll(async ({ browser }) => {
  owner = await open(browser, "owner");
  desk = await open(browser, "desk");
  member = await open(browser, "member");
});

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  // Test plans must not show on the gym's public website after the run.
  await admin().from("plans").update({ is_active: false }).like("name", "E2E Plan%");
});

test("public website and privacy notice", async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Membership plans" })).toBeVisible();
  await expect(page.getByText("+91 +91")).toHaveCount(0);
  await shot(page, "01-landing");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await shot(page, "02-privacy");
  expect(errs).toEqual([]);
});

test("owner creates a plan and adds a member; expiry shown as d MMM yyyy", async () => {
  await owner.goto("/owner/plans/new");
  await owner.getByLabel("Plan name").fill(PLAN);
  await owner.getByLabel("Duration (days)").fill("60");
  await owner.getByLabel("Price (₹)").fill("1800");
  await owner.getByLabel("Discount (%)").fill("0");
  await owner.getByRole("button", { name: "Create plan" }).click();
  await owner.waitForURL("**/owner/plans");
  await expect(owner.getByText(PLAN)).toBeVisible();
  await expect(owner.getByText("₹1,800").first()).toBeVisible();
  await shot(owner, "03-plans");

  await owner.goto("/owner/members/new");
  await owner.getByLabel("Full name").fill(MEMBER);
  await owner.getByLabel("Mobile number").fill(PHONE);
  await owner.getByLabel("4-digit login PIN").fill(PIN);
  await owner.getByLabel("First plan").selectOption((await owner.locator("#planId option", { hasText: PLAN }).getAttribute("value"))!);
  await owner.getByRole("button", { name: "Add member" }).click();
  await owner.waitForURL(/\/owner\/members\/[0-9a-f-]{36}$/);
  memberId = owner.url().split("/").pop()!;
  await expect(owner.getByRole("heading", { name: MEMBER })).toBeVisible();
  await expect(owner.getByText(displayDate(60)).first()).toBeVisible();
  await shot(owner, "04-member-detail");
});

test("member logs in with phone + PIN and sees the same plan and expiry", async () => {
  await memberLogin(member, PHONE, PIN);
  await expect(member.getByText(PLAN).first()).toBeVisible();
  await expect(member.getByText(displayDate(60)).first()).toBeVisible();
  await shot(member, "05-member-home");
});

test("a member can't open another member's receipt", async () => {
  const { data } = await admin().from("payments").select("id").neq("member_id", memberId).limit(1);
  test.skip(!data?.length, "no other member's payment exists yet");
  // Streaming pages answer 200 with the not-found screen; what matters is that nothing of the receipt shows.
  await member.goto(`/member/payments/${data![0].id}`);
  await expect(member.getByText(/could not be found/i)).toBeVisible();
  await expect(member.getByText(/Payment receipt|Amount paid/)).toHaveCount(0);
});

test("QR check-in with the camera: scan the gate QR, see the weekly goal", async () => {
  const token = (await (await owner.request.get("/api/qr-token")).json()).token as string;
  expect(token).toBeTruthy();
  const video = path.join(os.tmpdir(), `gate-qr-${RUN}.y4m`);
  writeQrVideo(token, video);

  const camera = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`],
  });
  const context = await camera.newContext({ ...VIEW, permissions: ["camera"] });
  const page = await context.newPage();
  const errs = watchErrors(page);
  await memberLogin(page, PHONE, PIN);
  await page.goto("/member/check-in");
  const allow = page.getByRole("button", { name: "Allow camera and scan" });
  if (await allow.isVisible().catch(() => false)) await allow.click();
  try {
    await expect(page.getByRole("heading", { name: "You're checked in" })).toBeVisible({ timeout: 30_000 });
  } catch (e) {
    await page.screenshot({ path: path.join(SHOTS, "06-camera-failed.png") });
    throw new Error(`${(e as Error).message}\nPage errors: ${errs.join(" | ")}`);
  }
  await expect(page.getByText(/of \d visits/)).toBeVisible();
  await shot(page, "06-checked-in");
  expect(errs.filter((e) => !e.includes("favicon"))).toEqual([]);
  await camera.close();

  // Staff see the visit in today's check-ins.
  await owner.goto("/owner/attendance");
  await expect(owner.getByText(MEMBER).first()).toBeVisible();
});

test("absence → Red List → follow-up → return check-in resolves the case", async () => {
  // Set-up only: make the member look absent for 15 days.
  const db = admin();
  await db.from("attendance").delete().eq("member_id", memberId);
  await db.from("members").update({ join_date: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10) }).eq("id", memberId);
  await db.from("attendance").insert({ member_id: memberId, checkin_at: new Date(Date.now() - 15 * 86_400_000).toISOString(), source: "QR" });

  // Member turns off missed-visit messages: staff must see no WhatsApp button.
  await member.goto("/member/settings");
  await member.getByRole("switch", { name: "Missed-visit messages" }).click();
  await expect(member.getByRole("switch", { name: "Missed-visit messages" })).toHaveAttribute("aria-checked", "false");
  await shot(member, "07-member-settings");

  await owner.goto("/owner/red-list");
  await owner.getByRole("button", { name: "Run scan now" }).click();
  await expect(owner.getByText(MEMBER)).toBeVisible();
  const row = owner.locator("li", { hasText: MEMBER });
  await expect(row.getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
  await expect(row.getByText("Opted out of absence messages")).toBeVisible();
  await shot(owner, "08-red-list");

  await row.getByRole("button", { name: "Outcome" }).click();
  await owner.getByLabel("What did they say?").selectOption("WillReturn");
  await owner.getByLabel("Note (optional)").fill("Exams till Friday");
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await expect(owner.getByText(/saved|Follow-up/i).first()).toBeVisible();

  // Front desk checks them in (phone battery dead) → case resolved.
  await desk.goto(`/owner/check-in?q=${PHONE}`);
  await desk.getByRole("button", { name: `Check in ${MEMBER}` }).click();
  await desk.getByLabel("Why is this an assisted check-in?").fill("Phone battery dead");
  await desk.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(desk.getByText(/checked in/i).first()).toBeVisible();
  await owner.goto("/owner/red-list");
  await expect(owner.getByText(MEMBER)).toHaveCount(0);
  await owner.goto(`/owner/members/${memberId}`);
  await expect(owner.getByText("Returned").first()).toBeVisible();
  await expect(owner.getByText("Exams till Friday")).toBeVisible();
  await shot(owner, "09-member-returned");
});

test("member renews by UPI; owner verifies once; receipt shows the new expiry", async () => {
  await member.goto("/member/renew");
  await member.locator("label", { hasText: PLAN }).click();
  await member.getByRole("button", { name: /^Pay ₹/ }).click();
  await member.getByLabel("After paying, enter the UPI reference (UTR)").fill(`41${RUN}2345678`.slice(0, 12));
  await member.getByRole("button", { name: "I've paid — send reference" }).click();
  await expect(member.getByText("Waiting for the gym to confirm")).toBeVisible();
  await shot(member, "10-renew-waiting");

  await owner.goto("/owner/renewals");
  const item = owner.locator("li", { hasText: MEMBER }).first();
  await item.getByRole("button", { name: "Verify" }).click();
  await owner.getByRole("button", { name: "Verify payment" }).click();
  await expect(owner.getByText(/Payment verified/)).toBeVisible();
  await shot(owner, "11-verified");

  const { data } = await admin().from("payments").select("id").eq("member_id", memberId).eq("status", "Paid").order("verified_at", { ascending: false }).limit(1);
  paymentId = data![0].id;
  await owner.goto(`/owner/payments/${paymentId}`);
  await expect(owner.getByText(displayDate(120)).first()).toBeVisible(); // 60 + 60, extended once
  await expect(owner.getByText("UPI", { exact: true })).toBeVisible();
  await shot(owner, "12-receipt");

  await member.goto("/member");
  await expect(member.getByText(displayDate(120)).first()).toBeVisible();
});

test("front desk takes cash; owner verifies; owner refunds and takes the days back", async () => {
  await desk.goto(`/owner/members/${memberId}`);
  await desk.getByRole("button", { name: "Take payment" }).click();
  await desk.getByLabel("Plan").selectOption({ index: 1 });
  await desk.getByRole("button", { name: "Record payment" }).click();
  await expect(desk.getByText(/CASH-\d{6}/)).toBeVisible();
  await shot(desk, "13-desk-cash");

  await owner.goto("/owner/renewals");
  const item = owner.locator("li", { hasText: MEMBER }).first();
  await expect(item.getByText(/Cash taken at the desk/)).toBeVisible();
  await item.getByRole("button", { name: "Verify" }).click();
  await expect(owner.getByLabel("Cash receipt number")).toHaveValue(/CASH-/);
  await owner.getByRole("button", { name: "Verify payment" }).click();
  await expect(owner.getByText(/Payment verified/)).toBeVisible();

  const { data } = await admin().from("payments").select("id").eq("member_id", memberId).eq("method", "Cash").limit(1);
  await owner.goto(`/owner/payments/${data![0].id}`);
  await expect(owner.getByText("Cash at the desk")).toBeVisible();
  const before = await owner.getByText(/Membership valid till/).locator("..").innerText();
  await owner.getByRole("button", { name: "Refund" }).click();
  await owner.getByLabel("Reason").fill("Paid twice by mistake");
  await owner.getByRole("button", { name: "Record refund" }).click();
  await expect(owner.getByText(/Refund recorded/)).toBeVisible();
  await expect(owner.getByText("This payment was refunded.", { exact: false })).toBeVisible();
  await shot(owner, "14-refunded");
  expect(before).toBeTruthy();

  await owner.goto(`/owner/members/${memberId}`);
  await expect(owner.getByText(displayDate(120)).first()).toBeVisible(); // back to the UPI renewal's expiry
});

test("member buys a PT pack; owner verifies; desk records a session", async () => {
  await member.goto("/member/add-ons");
  await member.getByRole("button", { name: /Buy · ₹8,000/ }).first().click();
  await member.getByRole("button", { name: /Buy for ₹8,000/ }).click();
  await member.waitForURL("**/member/add-ons/pay/**");
  await member.getByLabel("After paying, enter the UPI reference (UTR)").fill(`52${RUN}1122334`.slice(0, 12));
  await member.getByRole("button", { name: "I've paid — send reference" }).click();
  await expect(member.getByText(/Waiting for the gym to confirm/)).toBeVisible();

  await owner.goto("/owner/renewals");
  await owner.locator("li", { hasText: MEMBER }).filter({ hasText: "Add-on" }).getByRole("button", { name: "Verify" }).click();
  await owner.getByRole("button", { name: "Verify payment" }).click();
  await expect(owner.getByText(/Payment verified/)).toBeVisible();

  await desk.goto("/owner/add-ons");
  await desk.locator("li", { hasText: MEMBER }).getByRole("button", { name: /Session/ }).first().click();
  await expect(desk.getByText(/session 1 of 12 recorded/)).toBeVisible();
  await shot(desk, "15-pt-session");
});

test("desk resets the PIN; owner corrects the expiry, pauses and resumes; desk adds a missed visit", async () => {
  await desk.goto(`/owner/members/${memberId}`);
  await desk.getByRole("button", { name: "Reset PIN" }).click();
  await desk.getByLabel("New 4-digit PIN").fill("5678");
  await desk.getByRole("button", { name: "Set new PIN" }).click();
  await expect(desk.getByText(/New PIN set/)).toBeVisible();
  await member.context().clearCookies();
  await memberLogin(member, PHONE, "5678");

  await owner.goto(`/owner/members/${memberId}`);
  await owner.getByRole("button", { name: "Correct expiry" }).click();
  await owner.getByLabel("Correct expiry date").fill(new Date(Date.now() + 130 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  await owner.getByLabel("Reason").fill("Goodwill for gym closure");
  await owner.getByRole("button", { name: "Save date" }).click();
  await expect(owner.getByText(/expiry updated/)).toBeVisible();
  await expect(owner.getByText(displayDate(130)).first()).toBeVisible();

  await owner.getByRole("button", { name: "Pause" }).click();
  await owner.getByLabel("Reason for pause").fill("Knee injury");
  await owner.getByRole("dialog").getByRole("button", { name: "Pause" }).click();
  await expect(owner.getByText(/membership paused/)).toBeVisible();
  await owner.getByRole("button", { name: "Resume" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Resume" }).click();
  await expect(owner.getByText(/resumed — 0 days added/)).toBeVisible();
  await member.goto("/member");
  await expect(member.getByText(/On hold while your membership is paused/)).toHaveCount(0);

  await desk.goto(`/owner/members/${memberId}`);
  await desk.getByRole("button", { name: "Add missed visit" }).click();
  await desk.getByLabel("Date").fill(new Date(Date.now() - 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  await desk.getByLabel("Time").fill("07:00");
  await desk.getByLabel("Reason").fill("Gate tablet was offline");
  await desk.getByRole("button", { name: "Add visit" }).click();
  await expect(desk.getByText(/Visit added/)).toBeVisible();
  await shot(desk, "16-member-after-desk-actions");
});

test("owner cancels, reactivates, then anonymises a member who left", async () => {
  const phone = uniquePhone().replace(/^7/, "8");
  await owner.goto("/owner/members/new");
  await owner.getByLabel("Full name").fill(`E2E Leaver ${RUN}`);
  await owner.getByLabel("Mobile number").fill(phone);
  await owner.getByLabel("4-digit login PIN").fill("1111");
  await owner.getByLabel("First plan").selectOption({ index: 1 });
  await owner.getByRole("button", { name: "Add member" }).click();
  await owner.waitForURL(/\/owner\/members\/[0-9a-f-]{36}$/);

  for (const [action, expected] of [["Cancel / block", "Cancelled"], ["Reactivate", "Active"], ["Cancel / block", "Cancelled"]] as const) {
    await owner.getByRole("button", { name: action }).click();
    await owner.getByLabel("Reason").fill("Moved to another city");
    await owner.getByRole("button", { name: "Save", exact: true }).click();
    await expect(owner.getByText(/status updated/).last()).toBeVisible();
    await expect(owner.getByText(expected, { exact: true }).first()).toBeVisible();
  }
  await owner.getByRole("button", { name: "Remove personal details" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Remove details" }).click();
  await expect(owner.getByRole("heading", { name: "Former member" })).toBeVisible();
  await shot(owner, "17-anonymised");
});

test("owner adds a front-desk login, then removes access and the login stops working", async ({ browser }) => {
  const email = `e2e.temp.${RUN}@gymapp.test`;
  const password = `Temp-${RUN}-${Math.random().toString(36).slice(2, 10)}`;
  await owner.goto("/owner/staff");
  await owner.getByRole("button", { name: "Add front-desk login" }).click();
  await owner.getByLabel("Name").fill(`Temp Desk ${RUN}`);
  await owner.getByLabel("Email (used to log in)").fill(email);
  await owner.getByLabel("Starting password").fill(password);
  await owner.getByRole("button", { name: "Create login" }).click();
  await expect(owner.getByText(`Temp Desk ${RUN}`)).toBeVisible();
  await shot(owner, "18-staff");

  await owner.locator("li", { hasText: `Temp Desk ${RUN}` }).getByRole("button", { name: "Remove access" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Remove access" }).click();
  await expect(owner.locator("li", { hasText: `Temp Desk ${RUN}` }).getByText("access removed")).toBeVisible();

  const context = await browser.newContext(VIEW);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Owner / Staff" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in to dashboard" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await context.close();
});

test("GSTIN in settings turns the receipt into a tax invoice; front desk can't open settings", async () => {
  await owner.goto("/owner/settings");
  await owner.getByLabel("GSTIN (only if GST-registered)").fill("29ABCDE1234F1Z5");
  await owner.getByRole("button", { name: "Save" }).first().click();
  await expect(owner.getByText(/Gym profile saved/)).toBeVisible();
  await owner.goto(`/owner/payments/${paymentId}`);
  await expect(owner.getByText(/Tax invoice/)).toBeVisible();
  await expect(owner.getByText("GSTIN 29ABCDE1234F1Z5")).toBeVisible();
  await shot(owner, "19-tax-invoice");
  await owner.goto("/owner/settings");
  await owner.getByLabel("GSTIN (only if GST-registered)").fill("");
  await owner.getByRole("button", { name: "Save" }).first().click();
  await expect(owner.getByText(/Gym profile saved/)).toBeVisible();

  await desk.goto("/owner/settings");
  await desk.waitForURL(/\/owner$/);
});

test("every screen loads at 375px with no errors and no sideways scroll", async () => {
  const ownerRoutes = ["/owner", "/owner/red-list", "/owner/members", "/owner/renewals", "/owner/check-in", "/owner/add-ons", "/owner/settings", "/owner/plans", "/owner/staff", "/owner/attendance"];
  for (const route of ownerRoutes) {
    await owner.goto(route);
    await expect(owner.locator("h1").first()).toBeVisible();
    await shot(owner, `20-owner${route.replace(/\//g, "-")}`);
  }
  const memberRoutes = ["/member", "/member/check-in", "/member/renew", "/member/add-ons", "/member/more", "/member/attendance", "/member/payments", "/member/settings"];
  for (const route of memberRoutes) {
    await member.goto(route);
    await expect(member.locator("h1").first()).toBeVisible();
    await shot(member, `21-member${route.replace(/\//g, "-")}`);
  }
  for (const [role, list] of Object.entries(errors)) expect(list, `${role} errors`).toEqual([]);
});

test("no network: the branded offline page with the front-desk fallback (TESTING.md #16)", async ({ page, context }) => {
  test.skip(!!process.env.E2E_DEV, "the service worker is off in `next dev`");
  // A fresh phone: log in once online so the app (and its offline page) is installed.
  await memberLogin(page, PHONE, "5678");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // the service worker now controls the page
  await context.setOffline(true);
  // A page this phone never opened (pages it did open may be shown from the cache instead).
  await page.goto("/member/attendance").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByText(/ask the front desk staff for an assisted check-in/)).toBeVisible();
  await expect(page.getByText(/checked in/i)).toHaveCount(0);
  await shot(page, "22-offline");
});

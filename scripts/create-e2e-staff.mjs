#!/usr/bin/env node
// Creates (or resets) the two logins the Playwright tests use, on the TEST project only:
//   e2e.owner@gymapp.test (Owner) and e2e.desk@gymapp.test (FrontDesk).
// Random passwords are written to e2e/.auth/credentials.json (git-ignored) and never printed.
//
//   node scripts/create-e2e-staff.mjs
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { serviceClient } from "./lib.mjs";

const ACCOUNTS = [
  { key: "owner", email: "e2e.owner@gymapp.test", name: "E2E Owner", role: "Owner" },
  { key: "desk", email: "e2e.desk@gymapp.test", name: "E2E Front Desk", role: "FrontDesk" },
];

const supabase = serviceClient();
const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) throw new Error("Could not list auth users");

const credentials = {};
for (const a of ACCOUNTS) {
  const password = randomBytes(18).toString("base64url");
  const existing = list.users.find((u) => u.email === a.email);
  const user = existing
    ? (await supabase.auth.admin.updateUserById(existing.id, { password, ban_duration: "none" })).data.user
    : (await supabase.auth.admin.createUser({ email: a.email, password, email_confirm: true })).data.user;
  if (!user) throw new Error(`Could not create ${a.email}`);
  const { error: rowError } = await supabase
    .from("staff_users")
    .upsert({ id: user.id, name: a.name, role: a.role, is_active: true }, { onConflict: "id" });
  if (rowError) throw new Error(`Could not save the staff row for ${a.email}`);
  credentials[a.key] = { email: a.email, password, id: user.id };
  console.log(`  ✓ ${a.email} (${a.role})`);
}

fs.mkdirSync("e2e/.auth", { recursive: true });
fs.writeFileSync("e2e/.auth/credentials.json", JSON.stringify(credentials, null, 2), { mode: 0o600 });
console.log("Credentials saved to e2e/.auth/credentials.json (git-ignored).");

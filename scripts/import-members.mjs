#!/usr/bin/env node
// One-off import of the gym's existing members (GAPS C4, DEPLOYMENT.md §2.5).
//
//   node scripts/import-members.mjs members.csv            # dry run: checks every row, writes nothing
//   node scripts/import-members.mjs members.csv --commit   # imports, writes private/member-pins-<date>.csv
//
// CSV header (any order, case-insensitive):
//   name, phone, plan, expiry            required — plan must match a plan name in Owner → Plans
//   start, joined, weekly_target         optional — start defaults to expiry minus the plan length
// Dates: YYYY-MM-DD or DD/MM/YYYY. Phones: 10 digits, +91/spaces allowed.
//
// Each member gets a random 4-digit PIN. The PIN list is written to private/
// (git-ignored) for the front desk to hand over in person — never commit or
// share that file. Phones already in the app are skipped, never overwritten.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomInt, scryptSync } from "node:crypto";
import { parseCsv, serviceClient, todayKolkata, toCsv } from "./lib.mjs";

const [file, flag] = process.argv.slice(2);
const commit = flag === "--commit";
if (!file) {
  console.error("Usage: node scripts/import-members.mjs <members.csv> [--commit]");
  process.exit(2);
}

// Same stored format as hashPin() in src/services/auth.ts.
const hashPin = (pin) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pin, salt, 32).toString("hex")}`;
};

function parseDate(v) {
  const s = (v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const d = iso ? s : dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : null;
  // Rejects dates that don't exist, such as 31/02/2026.
  return d && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d ? d : null;
}
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const supabase = serviceClient();
const [{ data: plans, error: planError }, { data: existing, error: memberError }] = await Promise.all([
  supabase.from("plans").select("id, name, duration_days"),
  supabase.from("members").select("phone"),
]);
if (planError || memberError) throw new Error("Could not read plans/members from the database");
const planByName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p]));
const taken = new Set(existing.map((m) => m.phone));

const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
const col = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
for (const need of ["name", "phone", "plan", "expiry"]) {
  if (!(need in col)) throw new Error(`Missing column "${need}". Header found: ${header.join(", ")}`);
}

const today = todayKolkata();
const good = [];
const problems = [];
rows.forEach((r, i) => {
  const line = i + 2;
  const get = (k) => (k in col ? (r[col[k]] ?? "").trim() : "");
  const name = get("name");
  const phone = get("phone").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const plan = planByName.get(get("plan").toLowerCase());
  const expiry = parseDate(get("expiry"));
  const target = get("weekly_target") ? Number(get("weekly_target")) : 4;
  const issues = [];
  if (name.length < 2) issues.push("name missing");
  if (!/^[6-9]\d{9}$/.test(phone)) issues.push(`bad phone "${get("phone")}"`);
  else if (taken.has(phone)) issues.push(`phone ${phone} already in the app or earlier in the file`);
  if (!plan) issues.push(`unknown plan "${get("plan")}" (plans: ${plans.map((p) => p.name).join(", ")})`);
  if (!expiry) issues.push(`bad expiry "${get("expiry")}"`);
  if (!Number.isInteger(target) || target < 1 || target > 7) issues.push("weekly_target must be 1–7");
  const start = parseDate(get("start")) ?? (plan && expiry ? addDays(expiry, -plan.duration_days) : null);
  if (start && expiry && start > expiry) issues.push("start is after expiry");
  if (issues.length) return problems.push(`line ${line}: ${issues.join("; ")}`);
  taken.add(phone);
  good.push({ line, name, phone, plan, expiry, start, joined: parseDate(get("joined")) ?? start, target });
});

console.log(`${good.length} row(s) ready, ${problems.length} row(s) with problems.`);
problems.forEach((p) => console.log("  ✗ " + p));
if (!commit) {
  console.log(problems.length ? "\nFix the rows above, then run again." : "\nDry run only. Add --commit to import.");
  process.exitCode = problems.length ? 1 : 0;
} else if (problems.length) {
  console.log("\nNothing imported — fix every problem first so the file goes in as a whole.");
  process.exitCode = 1;
} else {
  await importAll();
}

async function importAll() {
  const pins = [["name", "phone", "pin"]];
  let imported = 0;
  for (const m of good) {
    const pin = String(randomInt(0, 10000)).padStart(4, "0");
    const status = m.expiry >= today ? "Active" : "Expired";
    const { data: member, error } = await supabase
      .from("members")
      .insert({ name: m.name, phone: m.phone, pin_hash: hashPin(pin), status, weekly_target: m.target, join_date: m.joined })
      .select("id")
      .single();
    if (error) {
      console.log(`  ✗ line ${m.line} ${m.name}: not imported (${error.code === "23505" ? "phone already exists" : "database error"})`);
      continue;
    }
    const { error: msError } = await supabase.from("memberships").insert({
      member_id: member.id, plan_id: m.plan.id, start_date: m.start, expiry_date: m.expiry, status, renewal_source: "Import",
    });
    if (msError) {
      await supabase.from("members").delete().eq("id", member.id); // brand new, no history yet
      console.log(`  ✗ line ${m.line} ${m.name}: not imported (membership could not be saved)`);
      continue;
    }
    pins.push([m.name, m.phone, pin]);
    imported++;
  }

  await supabase.from("audit_logs").insert({
    actor_type: "System", actor_id: "import-script", action: "member.imported", record_type: "member", record_id: path.basename(file),
    summary: `${imported} member(s) imported from ${path.basename(file)}.`,
  });

  fs.mkdirSync("private", { recursive: true });
  const out = path.join("private", `member-pins-${today}.csv`);
  fs.writeFileSync(out, toCsv(pins), { mode: 0o600 });
  console.log(`\nImported ${imported} of ${good.length}. PIN list for the front desk: ${out} (git-ignored — hand PINs over in person, then delete the file).`);
}

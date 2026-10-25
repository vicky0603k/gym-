#!/usr/bin/env node
// Weekly pilot backup (GAPS C11, DEPLOYMENT.md §7): every business table to CSV.
//
//   node scripts/backup.mjs              # writes backups/<YYYY-MM-DD>/*.csv (git-ignored)
//
// PIN hashes are left out. Keep the folder somewhere private (not in chat or
// email); it holds members' names and phone numbers.
import fs from "node:fs";
import path from "node:path";
import { serviceClient, todayKolkata, toCsv } from "./lib.mjs";

const TABLES = {
  members: "id, name, phone, status, assigned_trainer_id, weekly_target, join_date, marketing_consent, notify_renewal, notify_care, created_at, updated_at",
  memberships: "*",
  plans: "*",
  payments: "*",
  renewal_orders: "*",
  addons: "*",
  addon_orders: "*",
  attendance: "*",
  no_show_cases: "*",
  followups: "*",
  freeze_credits: "*",
  trainers: "*",
  staff_users: "*",
  settings: "*",
  audit_logs: "*",
};
const PAGE = 1000;

const supabase = serviceClient();
const dir = path.join("backups", todayKolkata());
fs.mkdirSync(dir, { recursive: true });

let failed = 0;
for (const [table, columns] of Object.entries(TABLES)) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order("created_at").range(from, from + PAGE - 1);
    if (error) {
      console.log(`  ✗ ${table}: ${error.message}`);
      failed++;
      break;
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const header = rows.length ? Object.keys(rows[0]) : columns === "*" ? [] : columns.split(", ");
  fs.writeFileSync(path.join(dir, `${table}.csv`), toCsv([header, ...rows.map((r) => header.map((h) => r[h]))]));
  console.log(`  ✓ ${table}: ${rows.length} row(s)`);
}
console.log(failed ? `\n${failed} table(s) failed — backup incomplete.` : `\nBackup written to ${dir}`);
process.exitCode = failed ? 1 : 0;

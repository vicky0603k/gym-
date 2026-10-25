/**
 * Live checks against the real Supabase project in .env.local (TEST project only):
 * the same API, Auth and RLS the app uses in production.
 *
 *   npm run test:live
 *
 * Creates two members for the run and marks them Cancelled afterwards
 * (history can't be deleted by design, so they stay as Cancelled test rows).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPin } from "@/services/auth";

const envText = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
const env = (k: string) => envText.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const URL = env("NEXT_PUBLIC_SUPABASE_URL");
const admin = createClient(URL, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const OWNER_EMAIL = "e2e.owner@gymapp.test";

const RUN = Date.now().toString().slice(-6);
type Member = { id: string; phone: string; client: SupabaseClient; paymentId: string };
const members: Member[] = [];
let ownerId = "";

/** Signs a member in the way services/auth.ts does: PIN check, then a session scoped by app_metadata.member_id. */
async function memberSession(memberId: string): Promise<SupabaseClient> {
  const email = `member-${memberId}@members.invalid`;
  await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { member_id: memberId } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const client = createClient(URL, env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
  const { error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties!.hashed_token });
  if (error) throw error;
  return client;
}

beforeAll(async () => {
  const { data: staff } = await admin.from("staff_users").select("id").eq("role", "Owner").eq("is_active", true);
  const users = await admin.auth.admin.listUsers({ perPage: 1000 });
  ownerId = users.data.users.find((u) => u.email === OWNER_EMAIL)?.id ?? staff![0].id;
  const { data: plan } = await admin.from("plans").select("id").eq("is_active", true).order("duration_days").limit(1).single();
  for (const n of [1, 2]) {
    const phone = `6${RUN}${n}${"0".repeat(2)}`.slice(0, 10);
    const { data: m, error } = await admin
      .from("members")
      .insert({ name: `Live Test ${RUN}-${n}`, phone, pin_hash: hashPin("2468") })
      .select("id")
      .single();
    if (error) throw error;
    await admin.from("memberships").insert({ member_id: m.id, plan_id: plan!.id, start_date: "2026-10-01", expiry_date: "2027-10-01", status: "Active" });
    const { data: order } = await admin.rpc("create_renewal_order", { p_member_id: m.id, p_plan_id: plan!.id });
    members.push({ id: m.id, phone, client: await memberSession(m.id), paymentId: (order as { payment_id: string }).payment_id });
  }
});

afterAll(async () => {
  for (const m of members) {
    await admin.rpc("set_member_status", { p_member_id: m.id, p_action: "Cancel", p_reason: "Live test run finished", p_staff_id: ownerId });
  }
});

describe("member login (live)", () => {
  it("a new member's PIN verifies through the same database functions the login uses", async () => {
    const { data: salt } = await admin.rpc("member_pin_salt", { p_phone: members[0].phone });
    expect(typeof salt).toBe("string");
    const { data: id } = await admin.rpc("verify_member_pin", { p_phone: members[0].phone, p_pin_hash: hashPin("2468", salt as string) });
    expect(id).toBe(members[0].id);
    const { data: wrong } = await admin.rpc("verify_member_pin", { p_phone: members[0].phone, p_pin_hash: hashPin("0000", salt as string) });
    expect(wrong).toBeNull();
  });
});

describe("RLS through the real API (TESTING.md row 15)", () => {
  it("member A sees only their own member row, memberships and payments", async () => {
    const [a, b] = members;
    const rows = await a.client.from("members").select("id, name");
    expect(rows.error).toBeNull();
    expect(rows.data!.map((r) => r.id)).toEqual([a.id]);

    const ships = await a.client.from("memberships").select("member_id");
    expect(ships.data!.every((r) => r.member_id === a.id)).toBe(true);

    const pays = await a.client.from("payments").select("id, member_id");
    expect(pays.data!.map((p) => p.id)).toContain(a.paymentId);
    expect(pays.data!.map((p) => p.id)).not.toContain(b.paymentId);
  });

  it("member A cannot open member B's payment (receipt) even by id", async () => {
    const res = await members[0].client.from("payments").select("id").eq("id", members[1].paymentId);
    expect(res.data).toEqual([]);
  });

  it("a member cannot read PIN hashes or change their own status", async () => {
    const pin = await members[0].client.from("members").select("pin_hash");
    expect(pin.error).not.toBeNull();
    const upd = await members[0].client.from("members").update({ status: "Active", weekly_target: 1 }).eq("id", members[0].id).select("id");
    expect(upd.data ?? []).toEqual([]);
  });

  it("a member cannot call money or check-in functions directly", async () => {
    const verify = await members[0].client.rpc("verify_payment", { p_payment_id: members[0].paymentId, p_provider_ref: "X123456", p_staff_id: ownerId });
    expect(verify.error).not.toBeNull();
    const checkin = await members[0].client.rpc("check_in", { p_member_id: members[0].id, p_source: "Assisted", p_staff_id: ownerId, p_reason: "x" });
    expect(checkin.error).not.toBeNull();
    const anon = createClient(URL, env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
    expect((await anon.from("members").select("id")).data ?? []).toEqual([]);
  });
});

describe("concurrency (live)", () => {
  it("two truly simultaneous scans for one member write exactly one attendance row", async () => {
    const id = members[1].id;
    const call = () => admin.rpc("check_in", { p_member_id: id, p_source: "Assisted", p_staff_id: ownerId, p_reason: "Simultaneous scan test" });
    const results = await Promise.all([call(), call(), call()]);
    const ok = results.filter((r) => (r.data as { ok: boolean }).ok);
    expect(ok).toHaveLength(1);
    const { count } = await admin.from("attendance").select("id", { count: "exact", head: true }).eq("member_id", id);
    expect(count).toBe(1);
  });

  it("verifying the same payment twice at once extends the membership exactly once", async () => {
    const m = members[0];
    const before = (await admin.from("memberships").select("expiry_date").eq("member_id", m.id).single()).data!.expiry_date;
    const verify = () => admin.rpc("verify_payment", { p_payment_id: m.paymentId, p_provider_ref: `LIVE${RUN}`, p_staff_id: ownerId });
    const results = await Promise.all([verify(), verify()]);
    expect(results.filter((r) => (r.data as { ok: boolean }).ok)).toHaveLength(1);
    const after = (await admin.from("memberships").select("expiry_date").eq("member_id", m.id).single()).data!.expiry_date;
    const days = (Date.parse(after) - Date.parse(before)) / 86_400_000;
    const { data: plan } = await admin.from("plans").select("duration_days").eq("is_active", true).order("duration_days").limit(1).single();
    expect(days).toBe(plan!.duration_days);
  });
});

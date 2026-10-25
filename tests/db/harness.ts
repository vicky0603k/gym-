/**
 * Database test harness: a real Postgres (PGlite, in-process) with every
 * migration in supabase/migrations and seed.sql applied, plus small stand-ins
 * for what Supabase provides (auth schema, API roles, default grants).
 *
 * These tests check the database rules themselves — transactions, guards,
 * RLS — without a network. tests/live/ repeats the critical ones against the
 * real Supabase project.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = path.resolve(__dirname, "../..");

// Mirrors what a fresh Supabase project has before our migrations run.
const SUPABASE_STANDINS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
create function digest(t text, alg text) returns bytea language sql immutable as $$ select sha256(convert_to(t, 'UTF8')) $$;
`;

export const OWNER = "b0000000-0000-0000-0000-000000000001";
export const DESK = "b0000000-0000-0000-0000-000000000002";
export const member = (n: number) => `e0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
export const PLAN = { monthly: "c0000000-0000-0000-0000-000000000001", quarterly: "c0000000-0000-0000-0000-000000000002", yearly: "c0000000-0000-0000-0000-000000000004" };

export interface TestDb {
  /** Rows of the last statement. */
  rows<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** First column of the first row. */
  one<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  /** Calls a function returning jsonb and gives back the parsed object. */
  call<T = Record<string, unknown>>(fn: string, ...args: unknown[]): Promise<T>;
  /** Run queries as the signed-in member (RLS applies), then switch back. */
  asMember<T>(memberId: string, work: () => Promise<T>): Promise<T>;
  /** Run queries as a signed-in staff user (RLS applies), then switch back. */
  asStaff<T>(staffId: string, work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  const dir = path.join(ROOT, "supabase", "migrations");
  for (const f of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8").replace(/create extension if not exists "pgcrypto";/i, "");
    await db.exec(sql).catch((e: Error) => {
      throw new Error(`${f}: ${e.message}`);
    });
  }
  await db.exec(fs.readFileSync(path.join(ROOT, "supabase", "seed.sql"), "utf8"));

  const rows = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
  const one = async <T,>(sql: string, params: unknown[] = []) => {
    const r = (await rows<Record<string, unknown>>(sql, params))[0];
    return (r ? Object.values(r)[0] : undefined) as T;
  };
  return {
    rows,
    one,
    call: async (fn, ...args) => {
      const list = args.map((_, i) => `$${i + 1}`).join(", ");
      return one(`select ${fn}(${list})::jsonb as r`, args);
    },
    asMember: async (memberId, work) => {
      await db.exec(`select set_config('test.jwt', '{"app_metadata":{"member_id":"${memberId}"}}', false); set role authenticated;`);
      try {
        return await work();
      } finally {
        await db.exec("reset role; select set_config('test.jwt', '', false);");
      }
    },
    asStaff: async (staffId, work) => {
      await db.exec(`select set_config('test.uid', '${staffId}', false); set role authenticated;`);
      try {
        return await work();
      } finally {
        await db.exec("reset role; select set_config('test.uid', '', false);");
      }
    },
    close: () => db.close(),
  };
}

/** Today's date in Asia/Kolkata as the database computes it. */
export const TODAY = "(now() at time zone 'Asia/Kolkata')::date";

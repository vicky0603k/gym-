/**
 * Server-side Supabase clients.
 *
 * createServerClient()  — uses the anon key + the user's session cookie.
 *                         Used in Server Components and server actions for
 *                         user-scoped queries (RLS enforced).
 *
 * createServiceClient() — uses the service role key.
 *                         Used ONLY for privileged server-side operations
 *                         (cron job, payment verification, RLS-bypassed writes).
 *                         NEVER expose to the browser or bundle.
 */
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be called from a Server Component where cookies are read-only.
            // Safe to ignore: the session will be refreshed client-side.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS. Only call from secure server code.
 * The SUPABASE_SERVICE_ROLE_KEY must never appear in client bundles.
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

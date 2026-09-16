import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The secret-key client. It bypasses RLS, so nothing about the caller is
 * checked by the database — the caller's permission must be established
 * before this is touched, and only ever in a server action that has done
 * so. Imported by src/features/admin/mutations.ts and nothing else. Used
 * only for auth.admin.* (creating, banning, deleting auth accounts); the
 * public-schema writes that follow go through the caller's own RLS client.
 *
 * "server-only" makes a client import a build error, not a leaked key.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The secret-key client. It bypasses RLS, so nothing about the caller is
 * checked by the database — the caller's permission must be established
 * before this is touched, and only ever in a server action that has done
 * so.
 *
 * Two importers, for two reasons that both need to outrank RLS:
 *
 *   src/features/admin/mutations.ts   auth.admin.* — creating, banning and
 *     deleting auth accounts. The public-schema writes that follow go
 *     through the caller's own RLS client.
 *
 *   src/features/notifications/email.ts   claim_pending_emails(), which is
 *     granted to service_role alone because it returns email addresses.
 *     It runs from after(), once the request's own transaction has
 *     committed, so there is no caller left to borrow an RLS client from —
 *     and the recipients are by definition other people than the caller.
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

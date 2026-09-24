import { createClient } from "@/lib/supabase/server";
import type { TableKey } from "./types";

/**
 * The signed-in user's saved columns for one table, raw — null when they
 * have never chosen (the table's Default). Pass it through resolveColumns()
 * before use: it may hold keys a later release no longer has.
 *
 * No profile filter: RLS returns only the caller's own rows, so the one
 * row for this table_key is theirs or there is none.
 */
export async function getSavedColumns(tableKey: TableKey): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_table_preferences")
    .select("columns")
    .eq("table_key", tableKey)
    .maybeSingle();

  // A preference is never worth failing the page over: fall back to Default.
  if (error) return null;
  return data?.columns ?? null;
}

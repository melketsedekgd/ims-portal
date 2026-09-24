"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { resolveColumns } from "@/lib/columns";
import { TABLE_REGISTRIES } from "./types";

type SaveResult = { ok: true } | { ok: false; message: string };

const tableKey = z.enum(["kpis", "risks"]);

const saveInput = z.object({
  tableKey,
  columns: z.array(z.string().max(64)).max(50),
});

/**
 * Saves the user's column choice for a table: one row per user per table,
 * replaced on every save. Keys are resolved against the registry first, so
 * what is stored is what the table shows — unknown keys dropped, locked
 * keys present, registry order.
 */
export async function saveTableColumns(table: string, columns: string[]): Promise<SaveResult> {
  const parsed = saveInput.safeParse({ tableKey: table, columns });
  if (!parsed.success) return { ok: false, message: "Your columns could not be saved." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has ended. Sign in again." };

  const { tableKey: key } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("user_table_preferences").upsert(
    {
      profile_id: user.id,
      table_key: key,
      columns: resolveColumns(TABLE_REGISTRIES[key], parsed.data.columns),
    },
    { onConflict: "profile_id,table_key" }
  );

  if (error) return { ok: false, message: "Your columns could not be saved." };
  return { ok: true };
}

/**
 * Back to Default by removing the row: no row reads as Default, so a later
 * change to the Default preset reaches this user too. RLS scopes the delete
 * to the caller's own row.
 */
export async function resetTableColumns(table: string): Promise<SaveResult> {
  const parsed = tableKey.safeParse(table);
  if (!parsed.success) return { ok: false, message: "Your columns could not be reset." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_table_preferences")
    .delete()
    .eq("table_key", parsed.data);

  if (error) return { ok: false, message: "Your columns could not be reset." };
  return { ok: true };
}

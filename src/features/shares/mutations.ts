"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { shareErrorMessage } from "@/lib/save-errors";
import type { ShareRecipient } from "./types";

// Two reads live here beside the writes because the share dialog calls
// them from the browser, the same way the export actions are called.
// All four go through SECURITY DEFINER functions that check the caller;
// nothing here filters by department or decides who may share with whom.

const itemType = z.enum(["kpi", "risk"]);

// Typed by hand: the generated type says job_title is never null, and
// .returns<T[]>() is rejected on .rpc() as a single-to-array cast (see
// dashboard/queries.ts), so the rows are cast instead.
type RecipientRow = {
  profile_id: string;
  full_name: string;
  job_title: string | null;
  group_code: string;
  group_name: string;
};

/** The people the signed-in user may share with, grouped and sorted by the database. */
export async function listShareRecipients(): Promise<ShareRecipient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_share_recipients");
  if (error || !data) return [];
  return (data as unknown as RecipientRow[]).map((r) => ({
    profileId: r.profile_id,
    fullName: r.full_name,
    jobTitle: r.job_title,
    groupCode: r.group_code,
    groupName: r.group_name,
  }));
}

const accessInput = z.object({
  target: z.uuid(),
  type: itemType,
  ids: z.array(z.uuid()).min(1).max(200),
});

/**
 * The ids, of those given, that `target` cannot open. null when the check
 * itself failed — the dialog then shows no warning rather than a wrong one.
 */
export async function checkShareAccess(
  target: string,
  type: string,
  ids: string[]
): Promise<string[] | null> {
  const parsed = accessInput.safeParse({ target, type, ids });
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_access_check", {
    target: parsed.data.target,
    p_item_type: parsed.data.type,
    p_ids: parsed.data.ids,
  });
  if (error) return null;
  return data ?? [];
}

const shareInput = z.object({
  type: itemType,
  ids: z.array(z.uuid()).min(1).max(200),
  recipients: z.array(z.uuid()).min(1).max(20),
  note: z.string().max(500),
  year: z.number().int().min(2000).max(2100),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

export type CreateShareResult =
  | { ok: true; shareId: string }
  | { ok: false; message: string };

/** One transaction in create_share(): all recipients and all items, or nothing. */
export async function createShare(input: {
  type: string;
  ids: string[];
  recipients: string[];
  note: string;
  year: number;
  quarter: string;
}): Promise<CreateShareResult> {
  const parsed = shareInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: shareErrorMessage({ message: "share_invalid" }),
    };
  }
  const p = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_share", {
    p_item_type: p.type,
    p_ids: p.ids,
    p_recipients: p.recipients,
    p_note: p.note,
    p_year: p.year,
    p_quarter: p.quarter,
  });

  if (error || !data) {
    return { ok: false, message: shareErrorMessage(error ?? { message: "" }) };
  }
  return { ok: true, shareId: data };
}

/** Sets read_at on the caller's recipient row and bell entry. A no-op for the sender. */
export async function markShareRead(shareId: string): Promise<void> {
  if (!z.uuid().safeParse(shareId).success) return;
  const supabase = await createClient();
  await supabase.rpc("mark_share_read", { p_share_id: shareId });
}

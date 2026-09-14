"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import { changeRequestSchema, type ChangeRequestInput } from "./schema";

export type DocumentWriteResult =
  | { ok: true }
  | { ok: false; message: string };

const textOrNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Postgres errors translated for the toast. The two triggers write their
 * own sentences ("A request under review is moved by recording a
 * decision…", "A ims decision requires the request to be…"); those are
 * surfaced as they are. Only the bare RLS refusal and the CHECK get
 * replaced.
 */
function friendlyMessage(error: { code: string; message: string }): string {
  if (error.code === "42501") {
    return error.message.startsWith("new row violates") || error.message.includes("row-level security")
      ? "You do not have permission to do this."
      : error.message;
  }
  if (error.code === "23514") {
    return error.message.includes("rejection_needs_reason")
      ? "A reason is required to reject a change request."
      : error.message;
  }
  return error.message;
}

function revalidate(documentId: string) {
  revalidatePath(`/department/documents/${documentId}`);
  revalidatePath("/department/documents");
  revalidatePath("/department/approvals");
}

/** Raise a change request, straight to pending_owner. */
export async function createChangeRequest(
  input: ChangeRequestInput
): Promise<DocumentWriteResult> {
  const parsed = changeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const r = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in to request a change." };

  const row: TablesInsert<"document_change_requests"> = {
    document_id: r.documentId,
    requester_id: user.id,
    proposed_revision: r.proposedRevision,
    reason_for_change: r.reasonForChange,
    description_of_change: r.descriptionOfChange,
    affected_processes: textOrNull(r.affectedProcesses),
    related_iso_requirements: textOrNull(r.relatedIsoRequirements),
    proposed_effective_date: r.proposedEffectiveDate || null,
    status: "pending_owner",
  };

  const { error } = await supabase.from("document_change_requests").insert(row);
  if (error) return { ok: false, message: friendlyMessage(error) };

  revalidate(r.documentId);
  return { ok: true };
}

/**
 * Send a rejected request back for review. The only status a requester
 * sets after submission; the transition guard refuses everything else and
 * the update policy limits it to the requester's own row.
 */
export async function resubmitChangeRequest(
  requestId: string
): Promise<DocumentWriteResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_change_requests")
    .update({ status: "pending_owner" })
    .eq("id", requestId)
    .eq("status", "rejected")
    .select("document_id");
  if (error) return { ok: false, message: friendlyMessage(error) };
  // RLS hides a row it refuses rather than erroring on UPDATE.
  if (!data || data.length === 0) {
    return { ok: false, message: "Only the requester can resubmit a rejected request." };
  }

  revalidate(data[0].document_id);
  return { ok: true };
}

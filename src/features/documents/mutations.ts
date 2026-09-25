"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPendingEmails } from "@/features/notifications/email";
import type { Database, TablesInsert } from "@/types/database";
import {
  changeRequestSchema,
  decisionSchema,
  type ChangeRequestInput,
  type DecisionInput,
} from "./schema";

type RaiseChangeRequestArgs = Database["public"]["Functions"]["raise_change_request"]["Args"];

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
  revalidatePath("/department/approvals");
}

/**
 * The trigger has already written the notification rows, in the transaction
 * that moved the request. This only posts them.
 *
 * after() runs it once the response is out, so a slow or dead SMTP server
 * cannot make a reviewer wait for a decision that is already saved. Called on
 * the success paths only: a refused write wrote no rows, and there would be
 * nothing to claim.
 */
function queueEmails() {
  after(sendPendingEmails);
}

export type ChangeRequestResult =
  | { ok: true; documentId: string }
  | { ok: false; message: string };

/**
 * Raise a change request, straight to pending_owner. Goes through
 * raise_change_request() so that, when the document is new, the document
 * row and the request are one transaction: no orphan document if the
 * second insert is refused.
 */
export async function createChangeRequest(
  input: ChangeRequestInput
): Promise<ChangeRequestResult> {
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

  const isNew = r.requestType === "new";
  const args: { [K in keyof RaiseChangeRequestArgs]: string | null } = {
    p_document_id: isNew ? null : r.documentId || null,
    p_document_name: isNew ? textOrNull(r.documentName) : null,
    p_department_id: isNew ? r.departmentId || null : null,
    p_document_number: isNew ? textOrNull(r.documentNumber) : null,
    p_storage_url: isNew ? textOrNull(r.storageUrl) : null,
    p_proposed_revision: textOrNull(r.proposedRevision),
    p_reason: r.reasonForChange,
    p_description: r.descriptionOfChange,
    p_affected_processes: textOrNull(r.affectedProcesses),
    p_iso_refs: textOrNull(r.relatedIsoRequirements),
    p_effective_date: r.proposedEffectiveDate || null,
    p_request_type: r.requestType,
    p_document_type: isNew ? textOrNull(r.documentType) : null,
    p_supporting_file_url: textOrNull(r.supportingFileUrl),
  };

  // The generated Args type has every parameter as a non-null string —
  // Postgres cannot declare nullability on a function argument, and the
  // function takes null for "no document yet" and the optionals.
  const { data: requestId, error } = await supabase.rpc(
    "raise_change_request",
    args as unknown as RaiseChangeRequestArgs
  );
  if (error) return { ok: false, message: friendlyMessage(error) };

  const documentId = isNew ? await documentOfRequest(requestId) : r.documentId!;
  revalidate(documentId);
  queueEmails();
  return { ok: true, documentId };
}

async function documentOfRequest(requestId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_change_requests")
    .select("document_id")
    .eq("id", requestId)
    .single();
  if (error) throw error;
  return data.document_id;
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
  queueEmails();
  return { ok: true };
}

/**
 * Record a reviewer's decision. This is the only way a request under review
 * moves: apply_change_approval() advances it, publishes the revision on an
 * IMS approval, and bumps documents.current_revision. Nothing here touches
 * document_change_requests.status — that path is refused by the guard.
 */
export async function recordDecision(
  input: DecisionInput
): Promise<DocumentWriteResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid decision" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in to record a decision." };

  const { data: req, error: reqError } = await supabase
    .from("document_change_requests")
    .select("document_id")
    .eq("id", d.requestId)
    .maybeSingle();
  if (reqError) return { ok: false, message: friendlyMessage(reqError) };
  if (!req) return { ok: false, message: "This change request is not visible to you." };

  const row: TablesInsert<"document_change_approvals"> = {
    request_id: d.requestId,
    stage: d.stage,
    decision: d.decision,
    decided_by: user.id,
    reason: textOrNull(d.reason),
  };

  const { error } = await supabase.from("document_change_approvals").insert(row);
  if (error) return { ok: false, message: friendlyMessage(error) };

  revalidate(req.document_id);
  queueEmails();
  return { ok: true };
}

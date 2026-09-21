"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import { addEvidenceSchema, type AddEvidenceInput } from "./schema";

export type EvidenceMutationResult = { ok: true } | { ok: false; message: string };

const friendlyMessage: Record<string, string> = {
  "42501": "You do not have permission to add evidence for this record.",
};

// The polymorphic department guard (guard_evidence_linked_department) raises
// a plain exception, not a constraint violation, so it has no error code to
// key a lookup off of — matched on message text instead.
function messageFor(error: { code: string; message: string }): string {
  if (friendlyMessage[error.code]) return friendlyMessage[error.code];
  if (error.message.includes("does not match")) {
    return "This evidence's department does not match its linked record's department.";
  }
  return error.message;
}

/**
 * `path` is the page to revalidate — this component is embedded on several
 * detail pages, so the caller says which one rather than this hard-coding
 * a single route.
 */
export async function addEvidence(
  input: AddEvidenceInput,
  path: string
): Promise<EvidenceMutationResult> {
  const parsed = addEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid evidence" };
  }
  const e = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to add evidence." };
  }

  // Resolved server-side, not trusted from the client: department_id is the
  // whole point of the department guard, so it can't come from the caller.
  const { data: departmentId, error: deptError } = await supabase.rpc("department_of", {
    p_type: e.linkedType,
    p_id: e.linkedId,
  });
  if (deptError) {
    return { ok: false, message: deptError.message };
  }
  if (!departmentId) {
    return { ok: false, message: "Could not resolve the department for this record." };
  }

  const row: TablesInsert<"evidence"> = {
    department_id: departmentId,
    linked_type: e.linkedType,
    linked_id: e.linkedId,
    name: e.name,
    type: e.type,
    location: e.location || null,
    uploaded_by: user.id,
  };

  const { error } = await supabase.from("evidence").insert(row);
  if (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath(path);
  return { ok: true };
}

export async function deleteEvidence(id: string, path: string): Promise<EvidenceMutationResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("evidence").delete().eq("id", id);
  if (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath(path);
  return { ok: true };
}

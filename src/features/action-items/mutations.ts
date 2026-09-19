"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database";
import {
  createActionSchema,
  updateActionStatusSchema,
  type CreateActionInput,
  type UpdateActionStatusInput,
} from "./schema";

export type ActionMutationResult = { ok: true } | { ok: false; message: string };

const friendlyMessage: Record<string, string> = {
  "42501": "Only a department manager or IMS admin can create or edit actions.",
};

// The polymorphic department guard (guard_action_source_department) raises a
// plain exception, not a constraint violation, so it has no error code to
// key a lookup off of — matched on message instead.
function messageFor(error: { code: string; message: string }): string {
  if (friendlyMessage[error.code]) return friendlyMessage[error.code];
  if (error.message.includes("does not match")) {
    return "This action's department does not match its source record's department.";
  }
  return error.message;
}

export async function createAction(input: CreateActionInput): Promise<ActionMutationResult> {
  const parsed = createActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action" };
  }
  const a = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to create an action." };
  }

  const row: TablesInsert<"actions"> = {
    department_id: a.departmentId,
    source_type: a.sourceType,
    source_id: a.sourceId,
    title: a.title,
    description: a.description || null,
    owner_title: a.ownerTitle || null,
    priority: a.priority ?? null,
    start_date: a.startDate || null,
    due_date: a.dueDate || null,
    created_by: user.id,
  };

  const { error } = await supabase.from("actions").insert(row);
  if (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath("/department/actions");
  revalidatePath("/department");
  return { ok: true };
}

export async function updateActionStatus(
  input: UpdateActionStatusInput
): Promise<ActionMutationResult> {
  const parsed = updateActionStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid update" };
  }
  const a = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to update an action." };
  }

  const row: TablesUpdate<"actions"> = {
    status: a.status,
    completion_percentage: a.completionPercentage ?? null,
    completed_date: a.completedDate || null,
  };

  const { error } = await supabase.from("actions").update(row).eq("id", a.id);
  if (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath("/department/actions");
  revalidatePath("/department");
  return { ok: true };
}

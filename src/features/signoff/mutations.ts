"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPendingEmails } from "@/features/notifications/email";
import { decisionSchema, type DecisionInput } from "./schema";

export type DecisionResult =
  | { ok: true; signoffId: string }
  | { ok: false; message: string };

/**
 * Record a sign-off decision.
 *
 * Carries no permission logic of its own. record_quarter_decision() checks
 * the caller, the period, the current state and completeness, and it is the
 * only write path into quarter_signoffs — so a second opinion here could
 * only ever disagree with the authority.
 */
export async function recordQuarterDecision(
  input: DecisionInput
): Promise<DecisionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid decision" };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // The function returns the quarter_signoffs row itself, not a set, so the
  // result is the object — no .select() or .single() to unwrap.
  const { data, error } = await supabase.rpc("record_quarter_decision", {
    p_department_id: d.departmentId,
    p_period_id: d.periodId,
    p_decision: d.decision,
    p_reason: d.reason?.trim() || undefined,
  });

  if (error) {
    // The completeness message is written for the person reading it and
    // names the counts, so it is passed through rather than replaced.
    if (error.message.startsWith("quarter_incomplete")) {
      return { ok: false, message: error.message };
    }
    if (error.code === "42501") {
      return { ok: false, message: "You can't do that from this sign-off's current state." };
    }
    return { ok: false, message: error.message };
  }
  if (!data) return { ok: false, message: "The decision did not return a sign-off." };

  revalidatePath("/sign-off");
  revalidatePath(`/sign-off/${data.id}`);
  revalidatePath("/department");
  revalidatePath("/department/kpis");
  revalidatePath("/department/objectives");
  revalidatePath("/department/risks");

  // The trigger has already written the notification rows inside the RPC's
  // transaction. This only posts them, and after() runs it once the response
  // is out so a slow mail provider cannot delay a decision that is saved.
  after(sendPendingEmails);

  return { ok: true, signoffId: data.id };
}

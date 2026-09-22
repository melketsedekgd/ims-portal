"use server";

import { revalidatePath } from "next/cache";
import { saveErrorMessage } from "@/lib/save-errors";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import { riskAssessmentSchema, type RiskAssessmentInput } from "./schema";

export type SaveRiskAssessmentResult =
  | { ok: true }
  | { ok: false; message: string };

/** Empty or whitespace-only text clears the column rather than storing "". */
const textOrNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Postgres error codes the rating dialog can hit, translated for the toast.
 *
 *   42501  RLS rejected the row: a closed period, a risk outside the user's
 *          department, or a reviewer. The client already disables the form
 *          for a closed period, so one message covers all three.
 */
const friendlyMessage: Record<string, string> = {
  "42501": "You do not have permission to rate this risk for this period.",
};

/**
 * Create or replace the residual assessment for one risk in one reporting
 * period. Upserts on (risk_id, reporting_period_id); type is always
 * 'residual' — baselines are pre-treatment, period-less, and not recorded
 * from here. rpn is never sent: it is a generated column. No department
 * filter — RLS decides what this user may write.
 */
export async function saveRiskAssessment(
  input: RiskAssessmentInput
): Promise<SaveRiskAssessmentResult> {
  const parsed = riskAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
    };
  }
  const a = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to rate a risk." };
  }

  const row: TablesInsert<"risk_assessments"> = {
    risk_id: a.riskId,
    reporting_period_id: a.reportingPeriodId,
    type: "residual",
    severity: a.severity,
    likelihood: a.likelihood,
    assessed_by: user.id,
    assessed_at: new Date().toISOString(),
  };
  if (a.notes !== undefined) row.notes = textOrNull(a.notes);

  const { error } = await supabase
    .from("risk_assessments")
    .upsert(row, { onConflict: "risk_id,reporting_period_id" });

  if (error) {
    return {
      ok: false,
      message: saveErrorMessage(error, friendlyMessage[error.code] ?? error.message),
    };
  }

  revalidatePath("/department/risks");
  return { ok: true };
}

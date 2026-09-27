"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveErrorMessage } from "@/lib/save-errors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { joinAssets } from "./assets";
import {
  riskDefinitionSchema,
  riskReviewSchema,
  treatmentEditSchema,
  type RiskDefinitionInput,
  type RiskReviewInput,
  type TreatmentEditInput,
} from "./schema";

/** Empty or whitespace-only text clears the column rather than storing "". */
const textOrNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Postgres error codes the review dialog can hit, translated for the toast.
 *
 *   42501  RLS rejected the row: a closed period, a risk outside the user's
 *          department, or a reviewer. The client already disables the form
 *          for a closed period, so one message covers all three.
 */
const friendlyMessage: Record<string, string> = {
  "42501": "You do not have permission to rate this risk for this period.",
};

export type RecordRiskReviewResult =
  | { ok: true }
  | { ok: false; message: string };

type RecordRiskReviewArgs =
  Database["public"]["Functions"]["record_risk_review"]["Args"];

/**
 * Save one quarter's review of a risk: the residual score and, when the
 * risk has a treatment, that treatment's review for the same period.
 *
 * One RPC so both are saved or neither: record_risk_review() upserts the
 * residual on (risk_id, reporting_period_id) and the review on
 * (treatment_id, reporting_period_id). It is security invoker, so the
 * insert/update policies on both tables and the quarter lock apply as this
 * user. No department filter — RLS decides what this user may write.
 *
 * Replaces saveRiskAssessment, which upserted the residual alone from here;
 * the residual half of the function does exactly what it did.
 *
 * The reason and follow-up are only sent when the answer isn't Maintain.
 * The dialog hides them for Maintain, and text typed before switching to
 * Maintain should not be saved unseen.
 *
 * 23514 is the function's own check; its message is already a sentence.
 */
export async function recordRiskReview(
  input: RiskReviewInput
): Promise<RecordRiskReviewResult> {
  const parsed = riskReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid review",
    };
  }
  const r = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to review a risk." };
  }

  const t = r.treatment;
  const deviating = t !== null && t.effectiveness !== "maintain";

  // The generated Args type has every parameter as a non-null value —
  // Postgres cannot declare nullability on a function argument, and the
  // function takes null for the treatment of a risk that has none and for
  // blank text.
  const args: { [K in keyof RecordRiskReviewArgs]: RecordRiskReviewArgs[K] | null } = {
    p_risk_id: r.riskId,
    p_period_id: r.reportingPeriodId,
    p_severity: r.severity,
    p_likelihood: r.likelihood,
    p_notes: textOrNull(r.notes),
    p_treatment_id: t?.treatmentId ?? null,
    p_effectiveness: t?.effectiveness ?? null,
    p_solution_evidence: textOrNull(t?.solutionEvidence),
    p_reason: deviating ? textOrNull(t.reasonForDeviation) : null,
    p_followup: deviating ? textOrNull(t.followupMeasure) : null,
  };

  const { error } = await supabase.rpc(
    "record_risk_review",
    args as unknown as RecordRiskReviewArgs
  );

  if (error) {
    return {
      ok: false,
      message: saveErrorMessage(error, friendlyMessage[error.code] ?? error.message),
    };
  }

  revalidatePath("/department/risks");
  return { ok: true };
}

// ── Risk definitions ─────────────────────────────────────────────────────────

export type CreateRiskResult =
  | { ok: true }
  | { ok: false; message: string };

type CreateRiskArgs =
  Database["public"]["Functions"]["create_risk_with_baseline"]["Args"];

/**
 * Create a risk with its baseline assessment and treatment, then redirect
 * to its page.
 *
 * One RPC, not three inserts: create_risk_with_baseline() writes the risk,
 * its period-less baseline and its treatment in one transaction, so a
 * refused insert cannot leave a risk with no starting rating or no
 * treatment. The function is security invoker, so risks_insert,
 * risk_assessments_insert and risk_treatments_insert still apply as this
 * user. No department filter — RLS decides who may create where.
 *
 * On success this never resolves: redirect() throws to perform the
 * navigation, which is why it runs after every early return rather than
 * inside a try block that would catch and report it as an error.
 */
export async function createRisk(
  input: RiskDefinitionInput
): Promise<CreateRiskResult> {
  const parsed = riskDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid risk",
    };
  }
  const r = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to create a risk." };
  }

  // The generated Args type has every parameter as a non-null value —
  // Postgres cannot declare nullability on a function argument, and the
  // function takes null for the optional text, for "no process" and for
  // "no start date".
  const args: { [K in keyof CreateRiskArgs]: CreateRiskArgs[K] | null } = {
    p_department_id: r.departmentId,
    p_process_id: r.processId,
    p_affected_assets: joinAssets(r.affectedAssets),
    p_threat: textOrNull(r.threat),
    p_vulnerability: textOrNull(r.vulnerability),
    p_risk_statement: textOrNull(r.riskStatement),
    p_risk_owner_title: textOrNull(r.riskOwnerTitle),
    p_severity: r.severity,
    p_likelihood: r.likelihood,
    p_treatment_solution: r.treatmentSolution,
    p_monitoring_evidence: textOrNull(r.monitoringEvidence),
    p_treatment_owner_title: textOrNull(r.treatmentOwnerTitle),
    p_treatment_start: r.treatmentStart || null,
    p_treatment_target: r.treatmentTarget,
    p_treatment_status: r.treatmentStatus,
  };

  const { data: riskId, error } = await supabase.rpc(
    "create_risk_with_baseline",
    args as unknown as CreateRiskArgs
  );

  if (error) {
    return { ok: false, message: createRiskMessage(error) };
  }

  revalidatePath("/department/risks");
  redirect(`/department/risks/${riskId}`);
}

/**
 * Postgres errors the create form can hit.
 *
 *   42501  RLS refused the risk, its baseline or its treatment: not a
 *          manager of the department, and not the IMS Manager.
 *   23514  The function's own checks. "Process … does not belong to
 *          department …" carries two uuids, so it is translated; the
 *          dropdown filters by department, so it is unreachable from the
 *          form. The others (a bad rating, blank assets, a missing
 *          treatment or target date, target before start) are already
 *          sentences.
 */
function createRiskMessage(error: { code: string; message: string }): string {
  switch (error.code) {
    case "42501":
      return "Only a department manager or the IMS Manager can create a risk.";
    case "23514":
      return error.message.startsWith("Process")
        ? "The selected process belongs to a different department."
        : error.message;
    default:
      return error.message;
  }
}

// ── Treatments ───────────────────────────────────────────────────────────────

export type UpdateTreatmentResult =
  | { ok: true }
  | { ok: false; message: string };

const NOT_A_MANAGER =
  "Only a department manager or the IMS Manager can edit this treatment.";

/**
 * Save an edited treatment plan from the risk's page.
 *
 * A plain UPDATE: risk_treatments_update lets an IMS admin or a manager of
 * the risk's department through. RLS refusing an UPDATE is not an error —
 * it matches no row and reports success — so the returned row count is
 * what says whether anything was saved. The same holds for an id the user
 * cannot read. No department filter.
 *
 * completed_date is written only for Completed and cleared otherwise, so a
 * treatment moved back to In progress does not keep a date it no longer
 * has.
 */
export async function updateTreatment(
  input: TreatmentEditInput
): Promise<UpdateTreatmentResult> {
  const parsed = treatmentEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid treatment",
    };
  }
  const t = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to edit a treatment." };
  }

  const { data, error } = await supabase
    .from("risk_treatments")
    .update({
      treatment_solution: t.solution,
      monitoring_evidence: textOrNull(t.monitoringEvidence),
      owner_title: textOrNull(t.ownerTitle),
      start_date: t.startDate || null,
      target_date: t.targetDate,
      status: t.status,
      completed_date: t.status === "completed" ? t.completedDate || null : null,
    })
    .eq("id", t.treatmentId)
    .select("risk_id");

  if (error) {
    return { ok: false, message: updateTreatmentMessage(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: NOT_A_MANAGER };
  }

  revalidatePath(`/department/risks/${data[0].risk_id}`);
  revalidatePath("/department/risks");
  return { ok: true };
}

/**
 * Postgres errors the edit dialog can hit.
 *
 *   23514  The valid_dates CHECK: target before start. The dialog checks
 *          this first, so this is the database's word on the same rule.
 *   42501  RLS on the returned row; refused updates normally arrive as zero
 *          rows instead.
 */
function updateTreatmentMessage(error: { code: string; message: string }): string {
  if (error.code === "23514" && error.message.includes("valid_dates")) {
    return "The target date can't be before the start date.";
  }
  if (error.code === "42501") return NOT_A_MANAGER;
  return error.message;
}

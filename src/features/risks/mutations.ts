"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveErrorMessage } from "@/lib/save-errors";
import { createClient } from "@/lib/supabase/server";
import type { Database, TablesInsert } from "@/types/database";
import {
  riskAssessmentSchema,
  riskDefinitionSchema,
  type RiskAssessmentInput,
  type RiskDefinitionInput,
} from "./schema";

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

// ── Risk definitions ─────────────────────────────────────────────────────────

export type CreateRiskResult =
  | { ok: true }
  | { ok: false; message: string };

type CreateRiskArgs =
  Database["public"]["Functions"]["create_risk_with_baseline"]["Args"];

/**
 * Create a risk with its baseline assessment, then redirect to its page.
 *
 * One RPC, not two inserts: create_risk_with_baseline() writes the risk and
 * its period-less baseline in one transaction, so a refused assessment
 * cannot leave a risk with no starting rating. The function is security
 * invoker, so risks_insert and risk_assessments_insert still apply as this
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
  // function takes null for the optional text and for "no process".
  const args: { [K in keyof CreateRiskArgs]: CreateRiskArgs[K] | null } = {
    p_department_id: r.departmentId,
    p_process_id: r.processId,
    p_affected_assets: r.affectedAssets,
    p_threat: textOrNull(r.threat),
    p_vulnerability: textOrNull(r.vulnerability),
    p_risk_statement: textOrNull(r.riskStatement),
    p_risk_owner_title: textOrNull(r.riskOwnerTitle),
    p_severity: r.severity,
    p_likelihood: r.likelihood,
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
 *   42501  RLS refused the risk or its baseline: not a manager of the
 *          department, and not the IMS Manager.
 *   23514  The function's own checks. "Process … does not belong to
 *          department …" carries two uuids, so it is translated; the
 *          dropdown filters by department, so it is unreachable from the
 *          form. The others (a bad rating, blank assets) are already
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

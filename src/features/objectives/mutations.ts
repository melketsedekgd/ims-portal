"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import {
  objectiveMeasurementSchema,
  activityStatusSchema,
  type ObjectiveMeasurementInput,
  type ActivityStatusInput,
} from "./schema";

export type ObjectiveWriteResult =
  | { ok: true }
  | { ok: false; message: string };

/** Empty or whitespace-only text clears the column rather than storing "". */
const textOrNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Today as YYYY-MM-DD in UTC, matching how the periods queries compare dates. */
const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Create or replace the measurement for one objective in one period.
 *
 * Upserts on (objective_id, reporting_period_id). For an objective with
 * activities, achievement is not sent: snapshot_objective_measurement()
 * overwrites it and both counts from the live rows, and the client must
 * not be able to say otherwise. For one without, the client's achievement
 * is the figure. No department filter — RLS decides.
 */
export async function saveObjectiveMeasurement(
  input: ObjectiveMeasurementInput
): Promise<ObjectiveWriteResult> {
  const parsed = objectiveMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid measurement",
    };
  }
  const m = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to record a measurement." };
  }

  // Same test the trigger and objective_achievement() use: at least one
  // non-cancelled activity means the counts are the authority.
  const { count: activityCount, error: countError } = await supabase
    .from("objective_activities")
    .select("id", { count: "exact", head: true })
    .eq("objective_id", m.objectiveId)
    .neq("status", "cancelled");
  if (countError) {
    return { ok: false, message: countError.message };
  }
  const derived = (activityCount ?? 0) > 0;

  const row: TablesInsert<"objective_measurements"> = {
    objective_id: m.objectiveId,
    reporting_period_id: m.reportingPeriodId,
    not_measured: m.notMeasured,
    recorded_by: user.id,
    recorded_at: new Date().toISOString(),
  };
  if (!derived) row.achievement = m.notMeasured ? null : m.achievement;
  // Optional text is three-valued: undefined leaves the column as it is on an
  // existing row, "" clears it, anything else replaces it.
  if (m.evidenceReference !== undefined) row.evidence_reference = textOrNull(m.evidenceReference);
  if (m.reasonForDeviation !== undefined) row.reason_for_deviation = textOrNull(m.reasonForDeviation);
  if (m.followupAction !== undefined) row.followup_action = textOrNull(m.followupAction);

  const { error } = await supabase
    .from("objective_measurements")
    .upsert(row, { onConflict: "objective_id,reporting_period_id" });

  if (error) {
    return { ok: false, message: friendlyMessage(error) };
  }

  revalidatePath("/department/objectives");
  return { ok: true };
}

/**
 * Move one activity between not_started / in_progress / completed.
 * completed_date follows the status: set on completion, cleared otherwise.
 * The definition columns are untouched, so guard_activity_definition() only
 * fires for a caller who cannot mark progress at all.
 */
export async function setActivityStatus(
  input: ActivityStatusInput
): Promise<ObjectiveWriteResult> {
  const parsed = activityStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid activity status",
    };
  }
  const a = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("objective_activities")
    .update({
      status: a.status,
      completed_date: a.status === "completed" ? todayUtc() : null,
    })
    .eq("id", a.activityId)
    .select("id");

  if (error) {
    return { ok: false, message: friendlyMessage(error) };
  }
  // RLS hides rows it refuses rather than erroring on UPDATE: zero rows
  // means the activity is not the caller's to change.
  if (!data || data.length === 0) {
    return { ok: false, message: "You do not have permission to update this activity." };
  }

  revalidatePath("/department/objectives");
  return { ok: true };
}

/**
 * Postgres errors the dialog can hit, translated for the toast.
 *
 *   42501 from guard_activity_definition() carries its own sentence
 *         ("Only a department manager or an IMS admin may …") — keep it.
 *   42501 from RLS is the bare "new row violates row-level security policy"
 *         — a closed period, another department, or a reviewer.
 */
function friendlyMessage(error: { code: string; message: string }): string {
  if (error.code === "42501") {
    return error.message.startsWith("Only ")
      ? error.message
      : "You do not have permission to record this for this period.";
  }
  return error.message;
}

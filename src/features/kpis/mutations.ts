"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import { kpiMeasurementSchema, type KpiMeasurementInput } from "./schema";

export type SaveKpiMeasurementResult =
  | { ok: true }
  | { ok: false; message: string };

/** Empty or whitespace-only text clears the column rather than storing "". */
const textOrNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Postgres error codes the entry form can hit, translated for the toast.
 * Anything else falls through with the driver's own message.
 *
 *   42501  RLS rejected the row: a closed period, or a KPI outside the user's
 *          department. The policy cannot say which, and the client already
 *          disables the form for a closed period, so a single message covers
 *          both without leaking the policy shape.
 */
const friendlyMessage: Record<string, string> = {
  "42501": "You do not have permission to record a measurement for this KPI and period.",
};

/**
 * Create or replace the measurement for one KPI in one reporting period.
 *
 * Upserts on (kpi_id, reporting_period_id). The payload is deliberately the
 * schema and nothing more: target_* are snapshotted by the insert trigger, and
 * achievement_override & co. are manager-only and guarded by another trigger.
 * No department filter — RLS decides what this user may write.
 */
export async function saveKpiMeasurement(
  input: KpiMeasurementInput
): Promise<SaveKpiMeasurementResult> {
  const parsed = kpiMeasurementSchema.safeParse(input);
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

  const row: TablesInsert<"kpi_measurements"> = {
    kpi_id: m.kpiId,
    reporting_period_id: m.reportingPeriodId,
    actual_value: m.actualValue,
    not_measured: m.notMeasured,
    recorded_by: user.id,
  };
  // Optional text is three-valued: undefined leaves the column as it is on an
  // existing row, "" clears it, anything else replaces it. A form that does
  // not show actual_text must not wipe the report's "8hr 27 mins" on re-save.
  if (m.actualText !== undefined) row.actual_text = textOrNull(m.actualText);
  if (m.remark !== undefined) row.remark = textOrNull(m.remark);
  if (m.evidenceReference !== undefined) {
    row.evidence_reference = textOrNull(m.evidenceReference);
  }

  const { error } = await supabase
    .from("kpi_measurements")
    .upsert(row, { onConflict: "kpi_id,reporting_period_id" });

  if (error) {
    return { ok: false, message: friendlyMessage[error.code] ?? error.message };
  }

  revalidatePath("/department/kpis");
  return { ok: true };
}

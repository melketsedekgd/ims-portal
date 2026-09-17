"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import { getUnits } from "./queries";
import { formatTargetText } from "./calculations";
import {
  kpiMeasurementSchema,
  kpiDefinitionSchemaFor,
  type KpiMeasurementInput,
  type KpiDefinitionInput,
} from "./schema";

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

// ── KPI definitions ──────────────────────────────────────────────────────────

export type CreateKpiResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Create a KPI definition, then redirect to the list.
 *
 * Permission is the database's: kpis_insert checks is_ims_admin() OR
 * department_id IN my_managed_department_ids(). Nothing here re-implements
 * that rule — a refusal comes back as 42501 and is shown as a message.
 *
 * target_text is composed here from direction, value and unit — the list
 * still displays it, so it must be written — using the unit's label from
 * `units`, the same source the list renders labels from. The client's
 * preview of it is never trusted. reporting_frequency is omitted so the
 * column default (quarterly) applies.
 *
 * On success this never resolves: redirect() throws to perform the
 * navigation, which is why it runs after every early return rather than
 * inside a try block that would catch and report it as an error.
 */
export async function createKpi(
  input: KpiDefinitionInput
): Promise<CreateKpiResult> {
  const units = await getUnits();
  const parsed = kpiDefinitionSchemaFor(units.map((u) => u.key)).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid KPI definition",
    };
  }
  const k = parsed.data;
  // The schema refine guarantees the key is in `units`, so the label exists.
  const unitLabel = units.find((u) => u.key === k.targetUnit)?.label ?? k.targetUnit;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to create a KPI." };
  }

  // display_order restarts at 1 per process and is contiguous on every
  // existing row; the new KPI goes at the end of its process.
  const { data: last, error: orderError } = await supabase
    .from("kpis")
    .select("display_order")
    .eq("process_id", k.processId)
    .order("display_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (orderError) {
    return { ok: false, message: orderError.message };
  }

  const row: TablesInsert<"kpis"> = {
    department_id: k.departmentId,
    process_id: k.processId,
    name: k.name,
    description: textOrNull(k.description),
    target_text: formatTargetText(k.targetDirection, k.targetValue, k.targetUnit, unitLabel),
    target_value: k.targetValue,
    target_unit: k.targetUnit,
    target_direction: k.targetDirection,
    measurement_frequency: k.measurementFrequency,
    aggregation_method: k.aggregationMethod,
    data_source: textOrNull(k.dataSource),
    analysis_methodology: textOrNull(k.analysisMethodology),
    responsibility_title: textOrNull(k.responsibilityTitle),
    display_order: (last?.display_order ?? 0) + 1,
    created_by: user.id,
  };

  const { error } = await supabase.from("kpis").insert(row);

  if (error) {
    return { ok: false, message: createKpiMessage(error, k.targetUnit) };
  }

  revalidatePath("/department/kpis");
  redirect("/department/kpis");
}

/**
 * Postgres errors the create form can hit.
 *
 *   42501  kpis_insert refused the department.
 *   23503  A foreign key failed. target_unit and process_id are the only
 *          FKs the form sets; PostgREST names the column in `details`
 *          ("Key (target_unit)=(x) is not present in table \"units\"").
 */
function createKpiMessage(
  error: { code: string; message: string; details: string | null },
  unit: string
): string {
  switch (error.code) {
    case "42501":
      return "Only a department manager or IMS admin can create a KPI.";
    case "23503": {
      const where = `${error.message} ${error.details ?? ""}`;
      if (where.includes("target_unit")) return `"${unit}" is not a known unit.`;
      if (where.includes("process_id")) return "The selected process does not exist.";
      return error.message;
    }
    default:
      return error.message;
  }
}

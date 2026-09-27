import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/lib/permissions";
import { getUnits, type UnitOption } from "@/features/kpis/queries";
import type { Enums, Tables } from "@/types/database";
import type { RowStatus } from "./review";
import {
  LOCKING_SIGNOFF_STATUSES,
  type ColumnMap,
  type ImportDepartment,
  type ImportQuarter,
  type QuarterLock,
  type SavedMapping,
} from "./types";

/** Roles that record results in their department. viewer and document_owner do not. */
const RECORDING_ROLES = new Set(["department_contributor", "department_manager"]);

/**
 * Departments this user can import results into: every active department
 * for an IMS admin, otherwise the ones they hold department_contributor or
 * department_manager in. Decides whether the Import button and page are
 * offered at all; empty for viewer, the coordinators and approver.
 *
 * What is shown, not what is allowed — import_batches_insert and the
 * kpi_measurements policies are the enforcement.
 */
export async function getImportDepartments(): Promise<ImportDepartment[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (isAdmin(user)) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code")
      .eq("status", "active")
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  const seen = new Map<string, ImportDepartment>();
  for (const r of user.roles) {
    if (RECORDING_ROLES.has(r.key) && r.departmentId && !seen.has(r.departmentId)) {
      seen.set(r.departmentId, {
        id: r.departmentId,
        name: r.departmentName ?? r.departmentCode ?? "",
        code: r.departmentCode ?? "",
      });
    }
  }
  return [...seen.values()];
}

/** Every quarterly reporting period, newest first. */
export async function getImportQuarters(): Promise<ImportQuarter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reporting_periods")
    .select("id, year, label, status")
    .eq("type", "quarterly")
    .order("year", { ascending: false })
    .order("label", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Every department-quarter whose sign-off locks it, as far as this user can
 * read quarter_signoffs. No department filter: RLS scopes it to the user's
 * departments, and those are the only ones they can import into anyway.
 */
export async function getQuarterLocks(): Promise<QuarterLock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quarter_signoffs")
    .select("department_id, reporting_period_id, status")
    .in("status", [...LOCKING_SIGNOFF_STATUSES]);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    departmentId: s.department_id,
    periodId: s.reporting_period_id,
    status: s.status,
  }));
}

/** Saved column mappings the user can read, most recently updated first. */
export async function getSavedMappings(): Promise<SavedMapping[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_mappings")
    .select("id, department_id, name, headers, column_map")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    departmentId: m.department_id,
    name: m.name,
    headers: m.headers,
    // The check constraint guarantees an object holding kpi_name and actual.
    columnMap: m.column_map as ColumnMap,
  }));
}

// ── Review ───────────────────────────────────────────────────────────────────

export type ReviewRow = {
  id: string;
  rowNumber: number;
  /** Every non-blank cell of the sheet row, by header name. */
  raw: Record<string, string>;
  kpiId: string | null;
  actualText: string | null;
  actualValue: number | null;
  actualUnit: string | null;
  notMeasured: boolean;
  remark: string | null;
  evidence: string | null;
  status: RowStatus;
  issue: string | null;
  replaceExisting: boolean;
  /** Filled by commit_import on a replaced row: what the measurement held before. */
  previous: string | null;
};

export type ReviewKpi = {
  id: string;
  name: string;
  processName: string;
  target: string;
  targetUnit: string | null;
};

export type ImportReview = {
  batchId: string;
  departmentId: string;
  periodId: string;
  status: Enums<"import_batch_status">;
  rows: ReviewRow[];
  /** The batch department's active KPIs, in list order. */
  kpis: ReviewKpi[];
  /** KPI id → the result already recorded for the batch's quarter, as displayed. */
  existing: Record<string, string>;
  units: UnitOption[];
};

type ImportRowRecord = Tables<"import_rows">;

/** A result as the KPI list shows it: N/A, the report's own text, or value + unit label. */
export function displayActual(
  m: { actual_text: string | null; actual_value: number | null; actual_unit: string | null; not_measured: boolean | null },
  unitLabel: (key: string | null) => string | null
): string {
  if (m.not_measured) return "N/A";
  if (m.actual_text) return m.actual_text;
  return m.actual_value != null ? [m.actual_value, unitLabel(m.actual_unit)].filter(Boolean).join(" ") : "";
}

export function toReviewRow(
  r: ImportRowRecord,
  unitLabel: (key: string | null) => string | null
): ReviewRow {
  return {
    id: r.id,
    rowNumber: r.row_number,
    raw: (r.raw ?? {}) as Record<string, string>,
    kpiId: r.kpi_id,
    actualText: r.actual_text,
    actualValue: r.actual_value,
    actualUnit: r.actual_unit,
    notMeasured: r.not_measured,
    remark: r.remark,
    evidence: r.evidence_reference,
    status: r.status,
    issue: r.issue,
    replaceExisting: r.replace_existing,
    previous:
      r.previous_not_measured === null
        ? null
        : displayActual(
            {
              actual_text: r.previous_actual_text,
              actual_value: r.previous_actual_value,
              actual_unit: r.previous_actual_unit,
              not_measured: r.previous_not_measured,
            },
            unitLabel
          ),
  };
}

/** PostgREST returns at most 1,000 rows per request; a report can stage more. */
const PAGE = 1000;

const order = (n: number | null | undefined) => n ?? 9999;

/**
 * One staged batch with everything the review screen needs. null when the
 * batch is not visible to this user (RLS) or does not exist.
 *
 * DELIBERATE DEPARTMENT FILTER on kpis: the batch's department, not the
 * reader's. An IMS admin reads every department's KPIs, and a row may only
 * be matched to one in the batch's department — commit_import refuses any
 * other. This is a scope, not a permission check.
 */
export async function getImportReview(batchId: string): Promise<ImportReview | null> {
  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .select("id, department_id, reporting_period_id, status")
    .eq("id", batchId)
    .maybeSingle();
  if (batchError) throw batchError;
  if (!batch) return null;

  const rows: ImportRowRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .order("row_number")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const { data: kpiRows, error: kpiError } = await supabase
    .from("kpis")
    .select("id, name, target_text, target_unit, display_order, processes ( name, display_order )")
    .eq("department_id", batch.department_id)
    .eq("status", "active")
    .returns<
      {
        id: string;
        name: string;
        target_text: string | null;
        target_unit: string | null;
        display_order: number | null;
        processes: { name: string; display_order: number | null } | null;
      }[]
    >();
  if (kpiError) throw kpiError;

  const kpis = (kpiRows ?? []).sort(
    (a, b) =>
      order(a.processes?.display_order) - order(b.processes?.display_order) ||
      order(a.display_order) - order(b.display_order)
  );

  const { data: measured, error: mError } = await supabase
    .from("kpi_measurements")
    .select("kpi_id, actual_text, actual_value, actual_unit, not_measured")
    .eq("reporting_period_id", batch.reporting_period_id)
    .in("kpi_id", kpis.map((k) => k.id));
  if (mError) throw mError;

  const units = await getUnits();
  const labels = new Map(units.map((u) => [u.key, u.label]));
  const unitLabel = (key: string | null) => (key ? (labels.get(key) ?? key) : null);

  return {
    batchId: batch.id,
    departmentId: batch.department_id,
    periodId: batch.reporting_period_id,
    status: batch.status,
    rows: rows.map((r) => toReviewRow(r, unitLabel)),
    kpis: kpis.map((k) => ({
      id: k.id,
      name: k.name,
      processName: k.processes?.name ?? "General",
      target: k.target_text ?? "",
      targetUnit: k.target_unit,
    })),
    existing: Object.fromEntries(
      (measured ?? []).map((m) => [m.kpi_id, displayActual(m, unitLabel)])
    ),
    units,
  };
}

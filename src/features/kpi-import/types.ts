import type { Enums } from "@/types/database";

/**
 * Pure types and rules for the KPI results import. No client or server
 * imports: the wizard, the queries and the actions all read these.
 */

/** The four columns a mapping can name. kpi_name and actual are required. */
export const IMPORT_FIELDS = ["kpi_name", "actual", "remark", "evidence"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const FIELD_LABEL: Record<ImportField, string> = {
  kpi_name: "KPI name",
  actual: "Result",
  remark: "Remark",
  evidence: "Evidence",
};

/**
 * Field → header name, as import_mappings.column_map stores it. Values are
 * normalised headers (normaliseHeader), so a saved mapping still applies
 * when a later report changes only the spacing or case of a header.
 */
export type ColumnMap = { kpi_name: string; actual: string; remark?: string; evidence?: string };

export type ImportDepartment = { id: string; name: string; code: string };

export type ImportQuarter = {
  id: string;
  year: number;
  label: string;
  status: Enums<"period_status">;
};

export type QuarterLock = {
  departmentId: string;
  periodId: string;
  status: Enums<"signoff_status">;
};

export type SavedMapping = {
  id: string;
  departmentId: string;
  name: string;
  headers: string[];
  columnMap: ColumnMap;
};

/**
 * The sign-off statuses that lock a department's quarter. The same list as
 * guard_quarter_lock() and commit_import's up-front check — keep them in
 * step.
 */
export const LOCKING_SIGNOFF_STATUSES = ["submitted", "approved", "received"] as const;

/**
 * Why an import into this department and quarter would be refused, or null
 * when it can go ahead. A UX rule only — commit_import and the
 * kpi_measurements policies are the enforcement:
 *
 *   locked  the quarter's sign-off is submitted/approved/received;
 *           commit_import raises quarter_locked for everyone, IMS included.
 *   closed  the period is closed; the insert/update policies refuse anyone
 *           but an IMS admin, so every new or replaced result would fail.
 */
export function importBlock(
  quarter: ImportQuarter,
  departmentId: string,
  locks: readonly QuarterLock[],
  isAdmin: boolean
): { kind: "locked" | "closed"; label: string } | null {
  if (locks.some((l) => l.departmentId === departmentId && l.periodId === quarter.id)) {
    return { kind: "locked", label: "Locked — import will be refused" };
  }
  if (quarter.status === "closed" && !isAdmin) {
    return { kind: "closed", label: "Closed — import will be refused" };
  }
  return null;
}

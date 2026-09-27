import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/lib/permissions";
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

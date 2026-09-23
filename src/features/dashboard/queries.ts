import { createClient } from "@/lib/supabase/server";
import type { SignoffStatus } from "@/features/signoff/queries";

/* ---------------------------------------------------------------------
 * The department selector
 *
 * ── On the departmentId parameter the dashboard queries now take ──
 *
 * CLAUDE.md's rule stands: never add a department filter to a query in
 * place of RLS. An empty list is a permissions result, and an .eq() that
 * papers over one hides a real bug.
 *
 * The selector's departmentId is a different thing. It narrows a read the
 * reader is already allowed to make, because they asked to look at one
 * department rather than all of the ones they can see. It is never the
 * only thing standing between a reader and someone else's data: every one
 * of these queries still runs under RLS, and an IT contributor who hand-
 * edits ?dept=SRD into the URL gets IT's empty intersection with SRD,
 * which is nothing — not SRD's figures.
 *
 * That is also why it is optional everywhere and passed by exactly one
 * caller. Undefined is the old behaviour, unchanged, which is what the KPI,
 * objective and risk list pages still use.
 * ------------------------------------------------------------------- */

export type DashboardDepartment = {
  id: string;
  code: string;
  name: string;
  takesPartInSignoff: boolean;
};

/**
 * Departments the IMS dashboard can be pointed at, alphabetically by name.
 *
 * Inactive departments are left out. Deletion here is soft — a department
 * that closed keeps its rows so its history still reads — but it is not
 * somewhere anyone is still reporting, and offering it in a live picker
 * invites someone to go looking for this quarter's figures in it.
 *
 * Departments that take no part in sign-off are included: not signing off
 * is not the same as not existing, and IMS itself is one of them.
 */
export async function getSelectableDepartments(): Promise<DashboardDepartment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("departments")
    .select("id, code, name, takes_part_in_signoff")
    .eq("status", "active")
    .order("name");

  if (error) throw error;

  return (data ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    takesPartInSignoff: d.takes_part_in_signoff,
  }));
}

/* ---------------------------------------------------------------------
 * The quarterly reporting tracker
 * ------------------------------------------------------------------- */

export type TrackerRow = {
  departmentId: string;
  code: string;
  name: string;
  kpiDue: number;
  kpiEntered: number;
  objDue: number;
  objEntered: number;
  riskDue: number;
  riskReassessed: number;
  /** Latest measurement or assessment touched for this quarter; null when none. */
  lastEntryAt: string | null;
  status: SignoffStatus;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  returnCount: number;
};

/**
 * The shape quarter_reporting_overview actually returns.
 *
 * Written out rather than taken from the generated types, which declare
 * every column of a set-returning function non-nullable. Six of these are
 * nullable in practice — the three names and three timestamps are null
 * until someone signs, and last_entry_at is null until someone enters
 * something.
 */
type OverviewRow = {
  department_id: string;
  code: string;
  name: string;
  kpi_due: number;
  kpi_entered: number;
  obj_due: number;
  obj_entered: number;
  risk_due: number;
  risk_reassessed: number;
  last_entry_at: string | null;
  status: SignoffStatus;
  submitted_by_name: string | null;
  submitted_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  received_by_name: string | null;
  received_at: string | null;
  return_count: number;
};

/**
 * Where each department stands on one quarter: how much of its data is in,
 * and how far its sign-off has got.
 *
 * Ordered by what IMS has to do about it, not alphabetically. An approved
 * quarter is waiting on IMS and nobody else; a submitted one is waiting on
 * its manager; an open or returned one is waiting on the department; and a
 * received one is finished and only there to be counted. Alphabetical
 * inside each group, which is the order the function already returns.
 */
const ATTENTION: Record<SignoffStatus, number> = {
  approved: 0,
  submitted: 1,
  open: 2,
  returned: 2,
  received: 3,
};

export async function getQuarterTracker(periodId: string): Promise<TrackerRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("quarter_reporting_overview", {
    p_period_id: periodId,
  });

  if (error) throw error;

  // Same cast as getMissingItems: a set-returning function's row type does
  // not survive inference through .rpc(), and .returns<T[]>() is rejected
  // there as a single-to-array cast.
  const rows = (data ?? []) as unknown as OverviewRow[];

  return rows
    .map((r) => ({
      departmentId: r.department_id,
      code: r.code,
      name: r.name,
      kpiDue: r.kpi_due,
      kpiEntered: r.kpi_entered,
      objDue: r.obj_due,
      objEntered: r.obj_entered,
      riskDue: r.risk_due,
      riskReassessed: r.risk_reassessed,
      lastEntryAt: r.last_entry_at,
      status: r.status,
      submittedByName: r.submitted_by_name,
      submittedAt: r.submitted_at,
      approvedByName: r.approved_by_name,
      approvedAt: r.approved_at,
      receivedByName: r.received_by_name,
      receivedAt: r.received_at,
      returnCount: r.return_count,
    }))
    .sort(
      (a, b) =>
        ATTENTION[a.status] - ATTENTION[b.status] || a.name.localeCompare(b.name)
    );
}

import { createClient } from "@/lib/supabase/server";
import type { SignoffStatus } from "@/features/signoff/queries";
import type { DepartmentQuarter } from "@/features/dashboard/company";
import { trackerRank } from "@/features/dashboard/tracker";

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
 * Ordered by trackerRank(), which the table shares, so a row's position and
 * its badge can never tell two different stories. Alphabetical inside each
 * group, which is the order the function already returns.
 */
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
      (a, b) => trackerRank(a) - trackerRank(b) || a.name.localeCompare(b.name)
    );
}

/* ---------------------------------------------------------------------
 * The company overview
 * ------------------------------------------------------------------- */

/** department_performance's row, as it actually comes back. */
type PerformanceRow = {
  department_id: string;
  code: string;
  name: string;
  period_id: string;
  quarter: string;
  kpi_measured: number;
  kpi_on_target: number;
  kpi_due: number;
  kpi_entered: number;
  obj_measured: number;
  obj_achievement_avg: number | null;
  obj_due: number;
  obj_entered: number;
  risks_active: number;
  risk_scores: number[] | null;
};

/**
 * Every department's quarters for one year.
 *
 * The whole year in one call: the overview's cards and heatmap read the
 * selected quarter out of it and the trend chart reads all four, so a
 * second round trip per quarter would be four queries answering what one
 * already knows.
 *
 * obj_achievement_avg arrives as numeric, which PostgREST renders as a
 * JSON number here but which the generated types call non-nullable — it is
 * null for any department that measured no objectives. Named explicitly
 * rather than trusted, along with the other five columns the generator
 * gets wrong on a set-returning function.
 */
export async function getDepartmentPerformance(
  year: number
): Promise<DepartmentQuarter[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("department_performance", {
    p_year: year,
  });

  if (error) throw error;

  const rows = (data ?? []) as unknown as PerformanceRow[];

  return rows.map((r) => ({
    departmentId: r.department_id,
    code: r.code,
    name: r.name,
    periodId: r.period_id,
    quarter: r.quarter,
    kpiMeasured: r.kpi_measured,
    kpiOnTarget: r.kpi_on_target,
    kpiDue: r.kpi_due,
    kpiEntered: r.kpi_entered,
    objMeasured: r.obj_measured,
    objAchievementAvg:
      r.obj_achievement_avg === null ? null : Number(r.obj_achievement_avg),
    objDue: r.obj_due,
    objEntered: r.obj_entered,
    risksActive: r.risks_active,
    // The function coalesces to an empty array; the null guard is for the
    // type, not for a case the query can produce.
    riskScores: r.risk_scores ?? [],
  }));
}

/** Today as YYYY-MM-DD in UTC, matching features/periods/queries.ts. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export type OverdueActions = {
  total: number;
  departments: number;
  byDepartment: Record<string, number>;
  /** Open work per department, overdue or not — the denominator. */
  openByDepartment: Record<string, number>;
};

/**
 * Open work that is past its due date, right now.
 *
 * Deliberately not per quarter. An action is overdue or it is not, today;
 * asking "was it overdue in Q1" would need a history nothing records, and
 * showing the same number against every quarter would imply one. The card
 * and the column both say "(now)" for that reason.
 *
 * Rows with no due date are not overdue — they were never promised for a
 * date, so nothing has slipped.
 */
export async function getOverdueActions(): Promise<OverdueActions> {
  const supabase = await createClient();

  // Every open item, not only the late ones: a department with nothing on
  // its list has nothing to be late with, and the heatmap needs to tell
  // that apart from a department that is genuinely on top of its work.
  const { data, error } = await supabase
    .from("v_open_action_items")
    .select("department_id, due_date")
    .returns<{ department_id: string | null; due_date: string | null }[]>();

  if (error) throw error;

  const today = todayUtc();
  const byDepartment: Record<string, number> = {};
  const openByDepartment: Record<string, number> = {};
  let total = 0;

  for (const row of data ?? []) {
    if (!row.department_id) continue;
    openByDepartment[row.department_id] =
      (openByDepartment[row.department_id] ?? 0) + 1;
    if (row.due_date !== null && row.due_date < today) {
      byDepartment[row.department_id] = (byDepartment[row.department_id] ?? 0) + 1;
      total++;
    }
  }

  return {
    total,
    departments: Object.keys(byDepartment).length,
    byDepartment,
    openByDepartment,
  };
}

/**
 * Which of a year's quarters are still open.
 *
 * The overview has to say which figures are provisional, and a quarter is
 * provisional exactly while its reporting period is open. Kept out of
 * department_performance because it is one fact about the period, not a
 * fact about any department, and repeating it on every department's row
 * would be six copies of one answer.
 */
export async function getQuarterOpenState(
  year: number
): Promise<Record<string, boolean>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reporting_periods")
    .select("label, status")
    .eq("type", "quarterly")
    .eq("year", year)
    .returns<{ label: string; status: string }[]>();

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((p) => [p.label, p.status === "open"])
  );
}

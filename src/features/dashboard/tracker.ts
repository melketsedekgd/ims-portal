import type { Enums } from "@/types/database";

/**
 * How the quarterly reporting tracker reads a row.
 *
 * Pure, and shared between the query that orders the rows and the table
 * that renders them. "Nothing to report" decides a badge, a count and a
 * sort position; three copies of that rule would drift, and the one that
 * drifted would put a department in a card it is not in the table.
 */

export type TrackerStatus = Enums<"signoff_status">;

/** Just the fields these rules read, so any row shape can be passed. */
type Reportable = {
  kpiDue: number;
  objDue: number;
  status: TrackerStatus;
};

/**
 * A department with no active KPIs and no active objectives owes this
 * quarter nothing.
 *
 * "Not submitted" would be an accusation, and counting it among the
 * departments IMS is waiting on inflates the number that decides whether
 * the quarter can close. Finance and Marketing are both in this position:
 * real departments, nothing set up yet.
 *
 * Restricted to quarters nobody has touched. If a department with nothing
 * due has somehow submitted, that is a real state and worth showing as
 * itself rather than hiding behind a dash.
 */
export function nothingToReport(row: Reportable): boolean {
  return row.kpiDue + row.objDue === 0 && row.status === "open";
}

/**
 * The tracker's own words for a sign-off state.
 *
 * Deliberately not the neutral vocabulary SignoffHeader uses. A department
 * reading its own dashboard is told "Submitted", a fact about its own
 * quarter. IMS scanning every row needs to know whose desk it is on, so
 * the badge says the same thing as the card counting it and the eye can go
 * from "1 Waiting for IMS" straight to the row that says it.
 */
export const TRACKER_LABEL: Record<TrackerStatus, string> = {
  open: "Not submitted",
  returned: "Returned",
  submitted: "With manager",
  approved: "Waiting for IMS",
  received: "Signed off",
};

/**
 * Ordered by what IMS has to do about it, not alphabetically.
 *
 * An approved quarter is waiting on IMS and nobody else; a submitted one
 * on its manager; an open or returned one on the department. A received
 * quarter is finished, and a department with nothing due was never in the
 * queue at all — both sit at the bottom, out of the way of the work.
 */
const ATTENTION: Record<TrackerStatus, number> = {
  approved: 0,
  submitted: 1,
  open: 2,
  returned: 2,
  received: 3,
};

export function trackerRank(row: Reportable): number {
  return nothingToReport(row) ? 4 : ATTENTION[row.status];
}

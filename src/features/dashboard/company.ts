import { riskBand } from "@/features/risks/scoring";

/**
 * Rolling department_performance rows up into the company overview.
 *
 * Pure, and separate from the query that fetches the rows, because the one
 * thing here that is easy to get wrong is arithmetic: a company percentage
 * is not the average of the department percentages. Keeping it out of the
 * component means it can be checked against SQL directly.
 */

/** One department, one quarter — department_performance's row, camel-cased. */
export type DepartmentQuarter = {
  departmentId: string;
  code: string;
  name: string;
  periodId: string;
  quarter: string;
  kpiMeasured: number;
  kpiOnTarget: number;
  objMeasured: number;
  /** 0..1 as stored, or null when the department measured no objectives. */
  objAchievementAvg: number | null;
  risksActive: number;
  /** Residual scores for the quarter, to be banded by riskBand(). */
  riskScores: number[];
};

/**
 * The company's objective achievement, as a 0..1 fraction.
 *
 * Weighted by how many objectives each department measured, which makes it
 * the mean of every measurement rather than the mean of the department
 * means. The two are different numbers and the difference is not small:
 * on Q1 2026, averaging IT's 33% with SRD's 100% gives 67%, while the six
 * measurements behind them average 56%. A department with one objective
 * would otherwise weigh as heavily as one with forty.
 *
 * Departments that measured nothing contribute no weight rather than a
 * zero, so they cannot drag the company down for having nothing to report.
 */
function weightedAchievement(rows: DepartmentQuarter[]): number | null {
  let measured = 0;
  let total = 0;

  for (const r of rows) {
    if (r.objAchievementAvg === null || r.objMeasured === 0) continue;
    measured += r.objMeasured;
    total += r.objAchievementAvg * r.objMeasured;
  }

  return measured === 0 ? null : total / measured;
}

/** How many of a quarter's residual scores are critical, per riskBand(). */
function criticalCount(rows: DepartmentQuarter[]): number {
  return rows.reduce(
    (n, r) => n + r.riskScores.filter((s) => riskBand(s) === "critical").length,
    0
  );
}

/** Active risks with no residual assessment recorded for the quarter. */
function notAssessedCount(rows: DepartmentQuarter[]): number {
  return rows.reduce(
    (n, r) => n + Math.max(0, r.risksActive - r.riskScores.length),
    0
  );
}

export type CompanyTotals = {
  kpiMeasured: number;
  kpiOnTarget: number;
  /** 0..1, or null when nothing was measured anywhere. */
  kpiRatio: number | null;
  objMeasured: number;
  /** 0..1, or null. */
  objAchievement: number | null;
  critical: number;
  risksActive: number;
  notAssessed: number;
  overdue: number;
  overdueDepartments: number;
};

export function companyTotals(
  rows: DepartmentQuarter[],
  overdue: { total: number; departments: number }
): CompanyTotals {
  const kpiMeasured = rows.reduce((n, r) => n + r.kpiMeasured, 0);
  const kpiOnTarget = rows.reduce((n, r) => n + r.kpiOnTarget, 0);

  return {
    kpiMeasured,
    kpiOnTarget,
    kpiRatio: kpiMeasured === 0 ? null : kpiOnTarget / kpiMeasured,
    objMeasured: rows.reduce((n, r) => n + r.objMeasured, 0),
    objAchievement: weightedAchievement(rows),
    critical: criticalCount(rows),
    risksActive: rows.reduce((n, r) => n + r.risksActive, 0),
    notAssessed: notAssessedCount(rows),
    overdue: overdue.total,
    overdueDepartments: overdue.departments,
  };
}

/** One heatmap row: a department's standing in the selected quarter. */
export type DepartmentStanding = {
  departmentId: string;
  code: string;
  name: string;
  /** 0..1, or null when nothing was measured. */
  kpiRatio: number | null;
  kpiMeasured: number;
  kpiOnTarget: number;
  objAchievement: number | null;
  objMeasured: number;
  critical: number;
  notAssessed: number;
  risksActive: number;
  overdue: number;
};

/**
 * The heatmap's rows for one quarter, alphabetical by department name.
 *
 * Overdue actions are keyed by department rather than carried on the
 * quarter row: they are a "right now" count with no quarter of their own,
 * so the same number appears whichever quarter is selected.
 */
export function departmentStandings(
  rows: DepartmentQuarter[],
  overdueByDepartment: Record<string, number>
): DepartmentStanding[] {
  return rows
    .map((r) => ({
      departmentId: r.departmentId,
      code: r.code,
      name: r.name,
      kpiRatio: r.kpiMeasured === 0 ? null : r.kpiOnTarget / r.kpiMeasured,
      kpiMeasured: r.kpiMeasured,
      kpiOnTarget: r.kpiOnTarget,
      objAchievement: r.objMeasured === 0 ? null : r.objAchievementAvg,
      objMeasured: r.objMeasured,
      critical: r.riskScores.filter((s) => riskBand(s) === "critical").length,
      notAssessed: Math.max(0, r.risksActive - r.riskScores.length),
      risksActive: r.risksActive,
      overdue: overdueByDepartment[r.departmentId] ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type TrendPoint = {
  quarter: string;
  /** 0..1, or null — a quarter with nothing measured is a gap, not a zero. */
  kpiRatio: number | null;
  objAchievement: number | null;
};

/**
 * The company across the year's quarters.
 *
 * Null rather than 0 where nothing was measured, so the line breaks instead
 * of diving to the floor. RiskScoreTrend learned the same lesson: a quarter
 * with no assessments is a gap, and a zero there reads as a collapse.
 */
export function companyTrend(all: DepartmentQuarter[]): TrendPoint[] {
  const quarters = [...new Set(all.map((r) => r.quarter))].sort();

  return quarters.map((quarter) => {
    const rows = all.filter((r) => r.quarter === quarter);
    const kpiMeasured = rows.reduce((n, r) => n + r.kpiMeasured, 0);
    const kpiOnTarget = rows.reduce((n, r) => n + r.kpiOnTarget, 0);

    return {
      quarter,
      kpiRatio: kpiMeasured === 0 ? null : kpiOnTarget / kpiMeasured,
      objAchievement: weightedAchievement(rows),
    };
  });
}

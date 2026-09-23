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
  /** Active KPIs owed a figure, and how many have one — quarter_missing_items' counts. */
  kpiDue: number;
  kpiEntered: number;
  objMeasured: number;
  /** 0..1 as stored, or null when the department measured no objectives. */
  objAchievementAvg: number | null;
  objDue: number;
  objEntered: number;
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
  /** Completeness, for deciding whether a figure can be judged yet. */
  kpiDue: number;
  kpiEntered: number;
  objDue: number;
  objEntered: number;
  /** Open work on the department's list, overdue or not. */
  openActions: number;
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
  overdueByDepartment: Record<string, number>,
  openByDepartment: Record<string, number>
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
      kpiDue: r.kpiDue,
      kpiEntered: r.kpiEntered,
      objDue: r.objDue,
      objEntered: r.objEntered,
      openActions: openByDepartment[r.departmentId] ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type TrendPoint = {
  quarter: string;
  /** 0..1, or null — a quarter with nothing measured is a gap, not a zero. */
  kpiRatio: number | null;
  objAchievement: number | null;
  /**
   * The quarter is still open, so its figures will move. Drawn hollow and
   * reached by a dashed line, because a provisional point on the same
   * footing as a closed one invites reading a half-entered quarter as a
   * fall.
   */
  provisional: boolean;
};

/**
 * The company across the year's quarters.
 *
 * Null rather than 0 where nothing was measured, so the line breaks instead
 * of diving to the floor. RiskScoreTrend learned the same lesson: a quarter
 * with no assessments is a gap, and a zero there reads as a collapse.
 */
export function companyTrend(
  all: DepartmentQuarter[],
  openQuarters: Record<string, boolean>
): TrendPoint[] {
  const quarters = [...new Set(all.map((r) => r.quarter))].sort();

  return quarters.map((quarter) => {
    const rows = all.filter((r) => r.quarter === quarter);
    const kpiMeasured = rows.reduce((n, r) => n + r.kpiMeasured, 0);
    const kpiOnTarget = rows.reduce((n, r) => n + r.kpiOnTarget, 0);

    return {
      quarter,
      kpiRatio: kpiMeasured === 0 ? null : kpiOnTarget / kpiMeasured,
      objAchievement: weightedAchievement(rows),
      provisional: openQuarters[quarter] ?? false,
    };
  });
}

/** A trend row as the chart consumes it: two series per measure. */
export type TrendSeriesRow = {
  quarter: string;
  provisional: boolean;
  /** The real figures, kept whole for the tooltip. */
  kpiRaw: number | null;
  objRaw: number | null;
  /** The solid line, cut short before a still-open quarter. */
  kpi: number | null;
  objectives: number | null;
  /** The dashed tail: the open quarter and the point the line leaves from. */
  kpiProvisional: number | null;
  objectivesProvisional: number | null;
};

/**
 * Split each measure into a solid series and a dashed one.
 *
 * The solid line stops before a quarter that is still open; the dashed one
 * covers the segment leading into it and the point itself. A provisional
 * figure then arrives on a dashed line under a hollow point instead of
 * sitting on the line as though it were final — Q3 2026 is a fifth of the
 * way entered and would otherwise read as a collapse.
 *
 * Percentages are whole numbers here, from asPercent, so the chart, the
 * cards and the heatmap round once and identically.
 */
export function trendSeries(
  trend: TrendPoint[],
  toPercent: (fraction: number | null) => number | null
): TrendSeriesRow[] {
  return trend.map((t, i) => {
    const kpi = toPercent(t.kpiRatio);
    const objectives = toPercent(t.objAchievement);
    // The point the dashed segment leaves from is the one before an open
    // quarter, so it belongs to both series.
    const onDashed = t.provisional || trend[i + 1]?.provisional === true;

    return {
      quarter: t.quarter,
      provisional: t.provisional,
      kpiRaw: kpi,
      objRaw: objectives,
      kpi: t.provisional ? null : kpi,
      objectives: t.provisional ? null : objectives,
      kpiProvisional: onDashed ? kpi : null,
      objectivesProvisional: onDashed ? objectives : null,
    };
  });
}

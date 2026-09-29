/**
 * KPIs on target per process, for the department dashboard.
 *
 * Pure — no React, no queries — like heatmap.ts. getProcessHealth() in
 * queries.ts reads the rows; everything decided about them is decided here.
 */

/** One KPI, reduced to what the card needs. */
export type ProcessKpi = {
  /** kpis.status is 'active'. Only active KPIs count towards this quarter. */
  kpiActive: boolean;
  process: { id: string; name: string; active: boolean; order: number | null };
  /**
   * kpi_achievement_ratio() for the selected quarter when a figure was
   * measured; null when nothing was entered or it was entered as N/A. N/A
   * is not zero and is not counted.
   */
  current: number | null;
  /** The same for the same quarter a year earlier. */
  prior: number | null;
};

export type ProcessHealthRow = {
  id: string;
  name: string;
  measured: number;
  onTarget: number;
  /** onTarget / measured, 0–100, rounded. */
  pct: number;
  /** pct minus last year's pct for the same quarter, in points; null with no prior data. */
  change: number | null;
};

export type ProcessHealth = {
  rows: ProcessHealthRow[];
  /** Processes with at least one measured KPI off target. */
  below: number;
  /** Processes with every measured KPI on target. */
  onTarget: number;
};

type Tally = {
  id: string;
  name: string;
  order: number;
  measured: number;
  onTarget: number;
  priorMeasured: number;
  priorOnTarget: number;
};

// Nulls sort last, as in the list queries.
const order = (n: number | null) => n ?? Number.POSITIVE_INFINITY;

export function processHealth(kpis: readonly ProcessKpi[]): ProcessHealth {
  const byProcess = new Map<string, Tally>();

  for (const k of kpis) {
    if (!k.process.active) continue;
    let t = byProcess.get(k.process.id);
    if (!t) {
      t = {
        id: k.process.id,
        name: k.process.name,
        order: order(k.process.order),
        measured: 0,
        onTarget: 0,
        priorMeasured: 0,
        priorOnTarget: 0,
      };
      byProcess.set(k.process.id, t);
    }

    // >= 1, not = 1: the ratio is capped at 1 but an override is not.
    if (k.kpiActive && k.current !== null) {
      t.measured++;
      if (k.current >= 1) t.onTarget++;
    }
    // Last year's KPIs may since have been retired; they still scored the
    // process then, so the comparison counts them whatever their status now.
    if (k.prior !== null) {
      t.priorMeasured++;
      if (k.prior >= 1) t.priorOnTarget++;
    }
  }

  // A process with no measured KPI has no score, not a zero: left out.
  const tallies = [...byProcess.values()].filter((t) => t.measured > 0);

  const rows = tallies
    .sort((a, b) => {
      const offA = a.measured - a.onTarget;
      const offB = b.measured - b.onTarget;
      // Below target first, then the fully-on-target ones.
      if ((offA > 0) !== (offB > 0)) return offA > 0 ? -1 : 1;
      return (
        a.onTarget / a.measured - b.onTarget / b.measured ||
        offB - offA ||
        a.order - b.order ||
        a.name.localeCompare(b.name)
      );
    })
    .map((t) => {
      const share = t.onTarget / t.measured;
      return {
        id: t.id,
        name: t.name,
        measured: t.measured,
        onTarget: t.onTarget,
        pct: Math.round(share * 100),
        change:
          t.priorMeasured > 0
            ? Math.round((share - t.priorOnTarget / t.priorMeasured) * 100)
            : null,
      };
    });

  return {
    rows,
    below: rows.filter((r) => r.onTarget < r.measured).length,
    onTarget: rows.filter((r) => r.onTarget === r.measured).length,
  };
}

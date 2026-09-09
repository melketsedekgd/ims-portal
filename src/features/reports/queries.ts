import { getKpisForPeriod } from "@/features/kpis/queries";
import { getRisksForPeriod } from "@/features/risks/queries";
import { getObjectivesForPeriod } from "@/features/objectives/queries";
import { riskBand } from "@/features/risks/scoring";

/**
 * Counts for one reporting period, composed from the three list queries the
 * KPI, risk and objective pages already use.
 *
 * Composed rather than re-queried on purpose: a separate aggregate query would
 * be a second definition of "achieved", "critical" and "reported", and the
 * report would eventually disagree with the page it summarises.
 *
 * Every bucket is counted, including the ones the old hardcoded snapshot left
 * out. A period with nothing entered reports its rows as Pending and Not
 * assessed rather than appearing to have no KPIs and no risks.
 *
 * These figures are recomputed on every view. Nothing freezes them, because
 * there is no reports table yet — publishing is a write, and the archive comes
 * after the write layer.
 */
export type PeriodSnapshot = {
  kpis: {
    achieved: number;
    deviated: number;
    pending: number;
    total: number;
  };
  risks: {
    critical: number;
    medium: number;
    low: number;
    notAssessed: number;
    total: number;
  };
  objectives: {
    measured: number;
    notMeasured: number;
    completedEarlier: number;
    notReported: number;
    total: number;
  };
};

export async function getPeriodSnapshot(
  year: number,
  label: string
): Promise<PeriodSnapshot> {
  const [kpis, risks, objectives] = await Promise.all([
    getKpisForPeriod(year, label),
    getRisksForPeriod(year, label),
    getObjectivesForPeriod(year, label),
  ]);

  const snapshot: PeriodSnapshot = {
    kpis: { achieved: 0, deviated: 0, pending: 0, total: kpis.length },
    risks: {
      critical: 0,
      medium: 0,
      low: 0,
      notAssessed: 0,
      total: risks.length,
    },
    objectives: {
      measured: 0,
      notMeasured: 0,
      completedEarlier: 0,
      notReported: 0,
      total: objectives.length,
    },
  };

  for (const k of kpis) {
    if (k.status === "Achieved") snapshot.kpis.achieved++;
    else if (k.status === "Deviated") snapshot.kpis.deviated++;
    else snapshot.kpis.pending++;
  }

  for (const r of risks) {
    // A risk with no residual assessment this period has no score. It is not a
    // low risk, and it is not a zero.
    if (r.riskScore === null) {
      snapshot.risks.notAssessed++;
      continue;
    }
    switch (riskBand(r.riskScore)) {
      case "critical":
        snapshot.risks.critical++;
        break;
      case "medium":
        snapshot.risks.medium++;
        break;
      case "low":
        snapshot.risks.low++;
        break;
    }
  }

  for (const o of objectives) {
    switch (o.outcome) {
      case "measured":
        snapshot.objectives.measured++;
        break;
      case "not_measured":
        snapshot.objectives.notMeasured++;
        break;
      case "completed_earlier":
        snapshot.objectives.completedEarlier++;
        break;
      case "not_reported":
        snapshot.objectives.notReported++;
        break;
    }
  }

  return snapshot;
}

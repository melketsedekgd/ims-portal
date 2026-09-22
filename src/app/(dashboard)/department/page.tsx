import { getCurrentPeriod } from "@/features/periods/queries";
import { getKpiCountsByQuarter } from "@/features/kpis/queries";
import { getObjectiveCountsByQuarter } from "@/features/objectives/queries";
import { getRisksForPeriod, getRiskScoresByQuarter } from "@/features/risks/queries";
import { getOpenActions } from "@/features/action-items/queries";
import { getPeriodSnapshot } from "@/features/reports/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { getHeaderSignoff } from "@/features/signoff/queries";
import DepartmentDashboard from "@/features/dashboard/components/DepartmentDashboard";

export default async function DepartmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

  // "Live" means the selected period is the current reporting period, resolved
  // from reporting_periods by date range — not from the browser's clock.
  const isLive =
    activeYear === String(current.year) && activeQuarter === current.label;

  // The KPI and objective year-series already contain the selected quarter, so
  // the overview cards read from them rather than issuing their own counts.
  // The cards and the charts then cannot disagree.
  //
  // The period snapshot runs its own three list queries, one of which
  // (getRisksForPeriod) is also issued here. Deliberately not deduped by
  // passing risks in: the snapshot would then have two sources for its
  // inputs and they would drift. getCurrentUser is React-cached and the
  // layout already called it.
  const [kpiSeries, objectiveSeries, risks, riskSeries, actions, snapshot, user, signoff] =
    await Promise.all([
      getKpiCountsByQuarter(Number(activeYear)),
      getObjectiveCountsByQuarter(Number(activeYear)),
      getRisksForPeriod(Number(activeYear), activeQuarter),
      getRiskScoresByQuarter(Number(activeYear)),
      getOpenActions(8),
      getPeriodSnapshot(Number(activeYear), activeQuarter),
      getCurrentUser(),
      getHeaderSignoff(Number(activeYear), activeQuarter),
    ]);

  const preparedBy = user
    ? [user.fullName, user.jobTitle].filter(Boolean).join(" — ")
    : "Unknown user";

  return (
    <DepartmentDashboard
      key={`${activeYear}-${activeQuarter}`}
      year={activeYear}
      quarter={activeQuarter}
      isLive={isLive}
      kpiSeries={kpiSeries}
      objectiveSeries={objectiveSeries}
      risks={risks}
      riskSeries={riskSeries}
      actions={actions}
      snapshot={snapshot}
      preparedBy={preparedBy}
      signoff={signoff}
    />
  );
}

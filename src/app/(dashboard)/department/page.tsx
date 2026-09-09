import { getCurrentPeriod } from "@/features/periods/queries";
import { getKpiCountsByQuarter } from "@/features/kpis/queries";
import { getObjectiveCountsByQuarter } from "@/features/objectives/queries";
import { getRisksForPeriod } from "@/features/risks/queries";
import { getOpenActionItems } from "@/features/action-items/queries";
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
  const [kpiSeries, objectiveSeries, risks, actionItems] = await Promise.all([
    getKpiCountsByQuarter(Number(activeYear)),
    getObjectiveCountsByQuarter(Number(activeYear)),
    getRisksForPeriod(Number(activeYear), activeQuarter),
    getOpenActionItems(),
  ]);

  return (
    <DepartmentDashboard
      key={`${activeYear}-${activeQuarter}`}
      year={activeYear}
      quarter={activeQuarter}
      isLive={isLive}
      kpiSeries={kpiSeries}
      objectiveSeries={objectiveSeries}
      risks={risks}
      actionItems={actionItems}
    />
  );
}

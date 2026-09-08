import { getKpisForPeriod } from "@/features/kpis/queries";
import KpiTracking from "@/features/kpis/components/KpiTracking";

const DEFAULT_YEAR = "2026";
const DEFAULT_QUARTER = "Q2";

export default async function KpiTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  const activeYear = year ?? DEFAULT_YEAR;
  const activeQuarter = quarter ?? DEFAULT_QUARTER;

  const kpis = await getKpisForPeriod(Number(activeYear), activeQuarter);

  return (
    <KpiTracking
      key={`${activeYear}-${activeQuarter}`}
      initialData={kpis}
      year={activeYear}
      quarter={activeQuarter}
    />
  );
}
import { getKpisForPeriod } from "@/features/kpis/queries";
import { getCurrentPeriod } from "@/features/periods/queries";
import KpiTracking from "@/features/kpis/components/KpiTracking";

export default async function KpiTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

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

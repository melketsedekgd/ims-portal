import { getRisksForPeriod } from "@/features/risks/queries";
import { getCurrentPeriod } from "@/features/periods/queries";
import RiskRegister from "@/features/risks/components/RiskRegister";

export default async function RiskRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

  const risks = await getRisksForPeriod(Number(activeYear), activeQuarter);

  return (
    <RiskRegister
      key={`${activeYear}-${activeQuarter}`}
      initialData={risks}
      year={activeYear}
      quarter={activeQuarter}
    />
  );
}

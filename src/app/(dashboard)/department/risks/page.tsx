import { getRisksForPeriod } from "@/features/risks/queries";
import RiskRegister from "@/features/risks/components/RiskRegister";

const DEFAULT_YEAR = "2026";
const DEFAULT_QUARTER = "Q2";

export default async function RiskRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  const activeYear = year ?? DEFAULT_YEAR;
  const activeQuarter = quarter ?? DEFAULT_QUARTER;

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

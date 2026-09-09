import { getObjectivesForPeriod } from "@/features/objectives/queries";
import { getCurrentPeriod } from "@/features/periods/queries";
import ObjectivesTable from "@/features/objectives/components/ObjectivesTable";

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

  const objectives = await getObjectivesForPeriod(
    Number(activeYear),
    activeQuarter
  );

  return (
    <ObjectivesTable
      key={`${activeYear}-${activeQuarter}`}
      initialData={objectives}
      year={activeYear}
      quarter={activeQuarter}
    />
  );
}

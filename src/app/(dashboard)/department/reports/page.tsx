import { getPeriodSnapshot } from "@/features/reports/queries";
import { getCurrentPeriod } from "@/features/periods/queries";
import { getCurrentUser } from "@/features/auth/queries";
import ReportsView from "@/features/reports/components/ReportsView";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const { year, quarter } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

  const [snapshot, user] = await Promise.all([
    getPeriodSnapshot(Number(activeYear), activeQuarter),
    getCurrentUser(),
  ]);

  const preparedBy = user
    ? [user.fullName, user.jobTitle].filter(Boolean).join(" — ")
    : "Unknown user";

  return (
    <ReportsView
      key={`${activeYear}-${activeQuarter}`}
      snapshot={snapshot}
      preparedBy={preparedBy}
      year={activeYear}
      quarter={activeQuarter}
    />
  );
}

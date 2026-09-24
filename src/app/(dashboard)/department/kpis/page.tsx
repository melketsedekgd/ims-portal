import { getKpisForPeriod, getCreatableDepartments } from "@/features/kpis/queries";
import { getCurrentPeriod, getQuarterPeriod } from "@/features/periods/queries";
import { getListDepartmentScope } from "@/features/dashboard/queries";
import { ALL_DEPARTMENTS } from "@/features/dashboard/view";
import DepartmentFilter from "@/components/shared/DepartmentFilter";
import KpiTracking from "@/features/kpis/components/KpiTracking";

export default async function KpiTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string; dept?: string }>;
}) {
  const { year, quarter, dept } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

  // IMS only; for everyone else ?dept= is ignored and RLS alone scopes the
  // list. A view filter, never a permission one.
  const { departments, selected } = await getListDepartmentScope(dept);

  const [kpis, period, creatable] = await Promise.all([
    getKpisForPeriod(Number(activeYear), activeQuarter, selected?.id),
    getQuarterPeriod(Number(activeYear), activeQuarter),
    getCreatableDepartments(),
  ]);

  return (
    <KpiTracking
      key={`${activeYear}-${activeQuarter}`}
      initialData={kpis}
      year={activeYear}
      quarter={activeQuarter}
      period={period}
      departmentFilter={
        departments.length > 0 ? (
          <DepartmentFilter
            departments={departments}
            value={selected?.code ?? ALL_DEPARTMENTS}
          />
        ) : null
      }
      canCreate={creatable.length > 0}
    />
  );
}

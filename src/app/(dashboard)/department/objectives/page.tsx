import { getObjectivesForPeriod } from "@/features/objectives/queries";
import { getCreatableDepartments } from "@/features/kpis/queries";
import {
  getCurrentPeriod,
  getQuarterPeriod,
  getReportingYears,
} from "@/features/periods/queries";
import { getListDepartmentScope } from "@/features/dashboard/queries";
import { ALL_DEPARTMENTS } from "@/features/dashboard/view";
import DepartmentFilter from "@/components/shared/DepartmentFilter";
import ObjectivesTable from "@/features/objectives/components/ObjectivesTable";

export default async function ObjectivesPage({
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

  const [objectives, period, creatable, years] = await Promise.all([
    getObjectivesForPeriod(Number(activeYear), activeQuarter, selected?.id),
    getQuarterPeriod(Number(activeYear), activeQuarter),
    getCreatableDepartments(),
    getReportingYears(),
  ]);

  return (
    <ObjectivesTable
      key={`${activeYear}-${activeQuarter}`}
      initialData={objectives}
      year={activeYear}
      quarter={activeQuarter}
      years={years}
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

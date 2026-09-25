import { getRisksForPeriod } from "@/features/risks/queries";
import {
  getCurrentPeriod,
  getQuarterPeriod,
  getReportingYears,
} from "@/features/periods/queries";
import { getListDepartmentScope } from "@/features/dashboard/queries";
import { ALL_DEPARTMENTS } from "@/features/dashboard/view";
import DepartmentFilter from "@/components/shared/DepartmentFilter";
import RiskRegister from "@/features/risks/components/RiskRegister";

export default async function RiskRegisterPage({
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

  const [risks, period, years] = await Promise.all([
    getRisksForPeriod(Number(activeYear), activeQuarter, selected?.id),
    getQuarterPeriod(Number(activeYear), activeQuarter),
    getReportingYears(),
  ]);

  return (
    <RiskRegister
      key={`${activeYear}-${activeQuarter}`}
      initialData={risks}
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
    />
  );
}

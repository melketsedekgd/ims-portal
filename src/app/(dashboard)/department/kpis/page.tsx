import {
  getKpisForPeriod,
  getCreatableDepartments,
  getKpiSparklines,
} from "@/features/kpis/queries";
import {
  getCurrentPeriod,
  getQuarterPeriod,
  getReportingYears,
} from "@/features/periods/queries";
import { getListDepartmentScope } from "@/features/dashboard/queries";
import { getImportDepartments } from "@/features/kpi-import/queries";
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

  const [kpis, period, creatable, years, importable, sparklines] = await Promise.all([
    getKpisForPeriod(Number(activeYear), activeQuarter, selected?.id),
    getQuarterPeriod(Number(activeYear), activeQuarter),
    getCreatableDepartments(),
    getReportingYears(),
    getImportDepartments(),
    // Same filters as the list, so every row on screen has an entry.
    getKpiSparklines(Number(activeYear), activeQuarter, selected?.id),
  ]);

  // Offered to whoever can record results in the department on screen:
  // an IMS admin anywhere, a contributor or manager in their own. The
  // quarter and department carry over to the import's first step.
  const canImport = selected
    ? importable.some((d) => d.id === selected.id)
    : importable.length > 0;
  const importHref = `/department/kpis/import?${new URLSearchParams({
    year: activeYear,
    quarter: activeQuarter,
    ...(selected ? { dept: selected.code } : {}),
  })}`;

  return (
    <KpiTracking
      key={`${activeYear}-${activeQuarter}`}
      initialData={kpis}
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
      importHref={canImport ? importHref : null}
      sparklines={sparklines}
    />
  );
}

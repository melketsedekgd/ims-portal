import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import {
  getImportDepartments,
  getImportQuarters,
  getQuarterLocks,
  getSavedMappings,
} from "@/features/kpi-import/queries";
import ImportWizard from "@/features/kpi-import/components/ImportWizard";
import { getCurrentPeriod } from "@/features/periods/queries";
import { canAddUnit, isAdmin } from "@/lib/permissions";

export default async function KpiImportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string; dept?: string }>;
}) {
  const departments = await getImportDepartments();

  // Nobody who can't record results gets a wizard that can only fail.
  if (departments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-[50vh] text-center px-6">
        <ShieldOff className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold">You can&apos;t import results</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          Importing KPI results is for department contributors, department
          managers and IMS admins.
        </p>
        <Link
          href="/department/kpis"
          className={`${buttonVariants({ variant: "outline" })} mt-6`}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to KPIs
        </Link>
      </div>
    );
  }

  const { year, quarter, dept } = await searchParams;
  const [user, quarters, locks, mappings, current] = await Promise.all([
    getCurrentUser(),
    getImportQuarters(),
    getQuarterLocks(),
    getSavedMappings(),
    getCurrentPeriod(),
  ]);

  // The KPI list's period and department, when the Import button carried
  // them; otherwise the current quarter and the first department. These only
  // seed the form — the batch is created with whatever is chosen in step 1.
  const wantYear = Number(year ?? current.year);
  const wantLabel = quarter ?? current.label;
  const defaultPeriodId =
    quarters.find((q) => q.year === wantYear && q.label === wantLabel)?.id ??
    quarters[0]?.id ??
    "";
  const defaultDepartmentId =
    departments.find((d) => d.code === dept)?.id ?? departments[0].id;

  return (
    <ImportWizard
      departments={departments}
      quarters={quarters}
      locks={locks}
      mappings={mappings}
      isAdmin={isAdmin(user)}
      canAddUnit={canAddUnit(user)}
      defaultDepartmentId={defaultDepartmentId}
      defaultPeriodId={defaultPeriodId}
    />
  );
}

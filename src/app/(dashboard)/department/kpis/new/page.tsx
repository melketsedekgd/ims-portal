import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  getCreatableDepartments,
  getProcessesForDepartments,
  getUnits,
} from "@/features/kpis/queries";
import KpiDefinitionForm from "@/features/kpis/components/KpiDefinitionForm";

export default async function CreateKpiPage() {
  const departments = await getCreatableDepartments();

  // No creatable department means kpis_insert would refuse every row this
  // user could send. Say so instead of rendering a form that can only fail.
  if (departments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-[50vh] text-center px-6">
        <ShieldOff className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold">You can&apos;t create KPIs</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          Only a department manager or an IMS admin can add a KPI definition.
          Measurements against existing KPIs are recorded from the KPI list.
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

  const [processes, units] = await Promise.all([
    getProcessesForDepartments(departments.map((d) => d.id)),
    getUnits(),
  ]);

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/department/kpis"
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0`}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New KPI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define a Key Performance Indicator
            {departments.length === 1 ? ` for ${departments[0].name}` : ""}.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <KpiDefinitionForm
          departments={departments}
          processes={processes}
          units={units}
        />
      </div>
    </div>
  );
}

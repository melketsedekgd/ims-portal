import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  getCreatableDepartments,
  getProcessesForDepartments,
} from "@/features/kpis/queries";
import ObjectiveDefinitionForm from "@/features/objectives/components/ObjectiveDefinitionForm";

export default async function CreateObjectivePage() {
  // Same rule as KPIs: objectives_insert checks is_ims_admin() OR
  // department_id IN my_managed_department_ids(), so the same list of
  // departments is the one the form may offer.
  const departments = await getCreatableDepartments();

  const processes = await getProcessesForDepartments(departments.map((d) => d.id));

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/department/objectives"
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0`}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Objective</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define a departmental objective
            {departments.length === 1 ? ` for ${departments[0].name}` : ""}, and how it is scored.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <ObjectiveDefinitionForm departments={departments} processes={processes} />
      </div>
    </div>
  );
}

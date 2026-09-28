import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import {
  getCreatableDepartments,
  getProcessesForDepartments,
} from "@/features/kpis/queries";
import RiskDefinitionForm from "@/features/risks/components/RiskDefinitionForm";
import { getRiskSuggestions } from "@/features/risks/queries";
import { canAddProcess } from "@/lib/permissions";

export default async function CreateRiskPage() {
  // Same rule as KPIs and objectives: the IMS Manager or the department's
  // manager may create, so the same list of departments is the one the form
  // may offer. create_risk_with_baseline() is security invoker, so RLS is
  // still what decides.
  const departments = await getCreatableDepartments();

  // No creatable department means every risk this user could send would be
  // refused. Say so instead of rendering a form that can only fail. A
  // department_contributor lands here from a typed URL, not from a button.
  if (departments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-[50vh] text-center px-6">
        <ShieldOff className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold">You can&apos;t create risks</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          Only a department manager or the IMS Manager can add a risk.
          Assessments and treatment reviews against existing risks are
          recorded from the risk register.
        </p>
        <Link
          href="/department/risks"
          className={`${buttonVariants({ variant: "outline" })} mt-6`}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Risks
        </Link>
      </div>
    );
  }

  const departmentIds = departments.map((d) => d.id);
  const [processes, suggestions] = await Promise.all([
    getProcessesForDepartments(departmentIds),
    getRiskSuggestions(departmentIds),
  ]);

  // "+ Add process…" is offered where processes_insert would pass: the IMS
  // Manager anywhere, a department manager in their own department.
  const user = await getCurrentUser();
  const processAddableDepartmentIds = departments
    .filter((d) => canAddProcess(user, d.id))
    .map((d) => d.id);

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/department/risks"
          aria-label="Back to Risks"
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0`}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New risk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adds the risk to
            {departments.length === 1 ? ` the ${departments[0].name}` : " the chosen department's"} register
            with its starting rating and treatment.
          </p>
        </div>
      </div>

      <RiskDefinitionForm
        departments={departments}
        processes={processes}
        suggestions={suggestions}
        processAddableDepartmentIds={processAddableDepartmentIds}
      />
    </div>
  );
}

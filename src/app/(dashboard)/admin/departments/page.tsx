import { Building2 } from "lucide-react";
import { getAdminDepartments } from "@/features/admin/queries";
import { ADMIN_DEPARTMENT_COLUMNS } from "@/features/admin/columns";
import { DepartmentSheet } from "@/features/admin/components/DepartmentSheet";
import { DepartmentsTable } from "@/features/admin/components/DepartmentsTable";
import { ColumnChoiceProvider } from "@/features/table-preferences/components/ColumnChoiceProvider";
import { getSavedColumns } from "@/features/table-preferences/queries";

/**
 * Departments with how many people hold a role in each. Everyone reaching
 * this page is an IMS admin — admin/layout.tsx has already turned everyone
 * else away — who creates and edits (retiring is a status, never a delete).
 */
export default async function DepartmentsPage() {
  const [departments, savedColumns] = await Promise.all([
    getAdminDepartments(),
    getSavedColumns("admin_departments"),
  ]);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            The units that objectives, KPIs and risks are filed under.
          </p>
        </div>
        <DepartmentSheet />
      </div>

      <ColumnChoiceProvider registry={ADMIN_DEPARTMENT_COLUMNS} saved={savedColumns} multiDepartment>
        <DepartmentsTable departments={departments} />
      </ColumnChoiceProvider>
    </div>
  );
}

import { RowSelectionProvider } from "@/components/shared/RowSelection";
import { getCurrentUser } from "@/features/auth/queries";
import { KPI_COLUMNS } from "@/features/kpis/columns";
import { ColumnChoiceProvider } from "@/features/table-preferences/components/ColumnChoiceProvider";
import { readsManyDepartments } from "@/lib/permissions";

// Holds the list's ticked rows and chosen columns. A layout, so both
// outlive the list remounting on a period or department change; see
// RowSelection.tsx and ColumnChoiceProvider.tsx.
export default async function ListLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <RowSelectionProvider>
      <ColumnChoiceProvider registry={KPI_COLUMNS} multiDepartment={readsManyDepartments(user)}>
        {children}
      </ColumnChoiceProvider>
    </RowSelectionProvider>
  );
}

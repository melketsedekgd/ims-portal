import { RowSelectionProvider } from "@/components/shared/RowSelection";
import { getCurrentUser } from "@/features/auth/queries";
import { KPI_COLUMNS } from "@/features/kpis/columns";
import { ColumnChoiceProvider } from "@/features/table-preferences/components/ColumnChoiceProvider";
import { getSavedColumns } from "@/features/table-preferences/queries";
import { readsManyDepartments } from "@/lib/permissions";

// Holds the list's ticked rows and chosen columns. A layout, so both
// outlive the list remounting on a period or department change; see
// RowSelection.tsx and ColumnChoiceProvider.tsx.
export default async function ListLayout({ children }: { children: React.ReactNode }) {
  // Read with the page, so the first paint is already the user's columns.
  const [user, saved] = await Promise.all([getCurrentUser(), getSavedColumns("kpis")]);

  return (
    <RowSelectionProvider>
      <ColumnChoiceProvider
        registry={KPI_COLUMNS}
        saved={saved}
        multiDepartment={readsManyDepartments(user)}
      >
        {children}
      </ColumnChoiceProvider>
    </RowSelectionProvider>
  );
}

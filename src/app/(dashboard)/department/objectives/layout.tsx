import { getCurrentUser } from "@/features/auth/queries";
import { OBJECTIVE_COLUMNS } from "@/features/objectives/columns";
import { ColumnChoiceProvider } from "@/features/table-preferences/components/ColumnChoiceProvider";
import { getSavedColumns } from "@/features/table-preferences/queries";
import { readsManyDepartments } from "@/lib/permissions";

// Holds the list's chosen columns. A layout, so the choice outlives the
// list remounting on a period or department change; see
// ColumnChoiceProvider.tsx.
export default async function ListLayout({ children }: { children: React.ReactNode }) {
  // Read with the page, so the first paint is already the user's columns.
  const [user, saved] = await Promise.all([getCurrentUser(), getSavedColumns("objectives")]);

  return (
    <ColumnChoiceProvider
      registry={OBJECTIVE_COLUMNS}
      saved={saved}
      multiDepartment={readsManyDepartments(user)}
    >
      {children}
    </ColumnChoiceProvider>
  );
}

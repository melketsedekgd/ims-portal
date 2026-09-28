import { getCurrentUser } from "@/features/auth/queries";
import { ACTION_COLUMNS } from "@/features/action-items/columns";
import { ColumnChoiceProvider } from "@/features/table-preferences/components/ColumnChoiceProvider";
import { getSavedColumns } from "@/features/table-preferences/queries";
import { readsManyDepartments } from "@/lib/permissions";

// Holds the list's chosen columns, as the KPI and risk layouts do; see
// ColumnChoiceProvider.tsx.
export default async function ListLayout({ children }: { children: React.ReactNode }) {
  // Read with the page, so the first paint is already the user's columns.
  const [user, saved] = await Promise.all([getCurrentUser(), getSavedColumns("actions")]);

  return (
    <ColumnChoiceProvider
      registry={ACTION_COLUMNS}
      saved={saved}
      multiDepartment={readsManyDepartments(user)}
    >
      {children}
    </ColumnChoiceProvider>
  );
}

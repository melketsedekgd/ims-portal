import { getActions } from "@/features/action-items/queries";
import { getCreatableDepartments } from "@/features/kpis/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin, managedDepartmentIds } from "@/lib/permissions";
import ActionsList from "@/features/action-items/components/ActionsList";

// Not period-scoped, deliberately: actions have due dates, not a reporting
// period, so there is no ?year=&quarter= here and no key prop forcing a
// remount — see ActionsList for the filter-in-state rationale.
export default async function ActionsPage() {
  const [actions, departments, user] = await Promise.all([
    getActions(),
    getCreatableDepartments(),
    getCurrentUser(),
  ]);

  const canManageDepartmentIds = isAdmin(user) ? ("all" as const) : managedDepartmentIds(user);

  return (
    <ActionsList
      initialData={actions}
      departments={departments}
      canManageDepartmentIds={canManageDepartmentIds}
    />
  );
}

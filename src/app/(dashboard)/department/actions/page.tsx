import { getActions, getActionSources } from "@/features/action-items/queries";
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

  // What each listed action belongs to — one read of v_action_sources by
  // the ids just fetched, so it needs the actions first.
  const sources = await getActionSources(actions.map((a) => a.id));

  const canManageDepartmentIds = isAdmin(user) ? ("all" as const) : managedDepartmentIds(user);

  return (
    <ActionsList
      initialData={actions}
      sources={sources}
      canCreate={departments.length > 0}
      canManageDepartmentIds={canManageDepartmentIds}
    />
  );
}

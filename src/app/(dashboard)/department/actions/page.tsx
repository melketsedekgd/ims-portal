import { getActions } from "@/features/action-items/queries";
import { getApprovalQueues } from "@/features/documents/queries";
import { getCreatableDepartments } from "@/features/kpis/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin, managedDepartmentIds } from "@/lib/permissions";
import { ActionCenterView } from "@/features/action-items/components/ActionCenterView";

/**
 * Action Center:
 *
 * 1. Incoming requests and decision queues waiting on the signed-in user
 *    (document approvals, coordinator review, owner decisions, publishing, etc.)
 * 2. Assigned action items across findings, KPIs, risks and objectives.
 */
export default async function ActionsPage() {
  const [queues, actions, departments, user] = await Promise.all([
    getApprovalQueues(),
    getActions(),
    getCreatableDepartments(),
    getCurrentUser(),
  ]);

  const canManageDepartmentIds = isAdmin(user)
    ? ("all" as const)
    : managedDepartmentIds(user);

  return (
    <ActionCenterView
      needsMyAction={queues.needsMyAction}
      initialActions={actions}
      departments={departments}
      canManageDepartmentIds={canManageDepartmentIds}
    />
  );
}

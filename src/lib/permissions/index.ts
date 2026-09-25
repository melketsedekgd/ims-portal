import type { CurrentUser } from "@/features/auth/queries";

/**
 * Role checks on the signed-in user, used by every admin route. Pure
 * functions over CurrentUser so they run in server components, server
 * actions and the sidebar alike. These decide what is rendered; RLS decides
 * what is written. The one exception is the secret-key client in
 * features/admin/mutations.ts, which bypasses RLS — there, isAdmin() IS the
 * permission.
 */

const ADMIN_KEYS = new Set(["ims_admin"]);

/** Holds ims_admin. Mirrors is_ims_admin() in SQL — there is no other admin tier. */
export function isAdmin(user: CurrentUser | null): boolean {
  return !!user && user.roles.some((r) => ADMIN_KEYS.has(r.key));
}

const IMS_VIEW_KEYS = new Set(["ims_admin", "qms_coordinator", "isms_coordinator", "approver"]);

/**
 * Holds any IMS-side role: ims_admin, qms_coordinator, isms_coordinator or
 * approver (CTO/VP). Mirrors is_ims() in SQL, which — after the two-phase
 * document workflow migration — is no longer an alias for is_ims_admin():
 * it governs the SELECT policies on kpis, risks, objectives, actions and
 * quarter_signoffs too, so these roles read across every department there,
 * not just on documents. Use this only to decide what is SHOWN (a wider
 * read than one department warrants); it must never gate a write — writes
 * outside a coordinator's or approver's own document stages still require
 * isAdmin, isDocCoordinator or isExecutiveApprover specifically.
 */
export function isImsView(user: CurrentUser | null): boolean {
  return !!user && user.roles.some((r) => IMS_VIEW_KEYS.has(r.key));
}

const DOC_COORDINATOR_KEYS = new Set(["qms_coordinator", "isms_coordinator"]);

/** Holds qms_coordinator or isms_coordinator. Mirrors is_doc_coordinator() in SQL. */
export function isDocCoordinator(user: CurrentUser | null): boolean {
  return !!user && user.roles.some((r) => DOC_COORDINATOR_KEYS.has(r.key));
}

/** Holds approver (shown as "CTO/VP"). Mirrors is_executive_approver() in SQL. */
export function isExecutiveApprover(user: CurrentUser | null): boolean {
  return !!user && user.roles.some((r) => r.key === "approver");
}

/** Departments the user holds department_manager in. Mirrors my_managed_department_ids(). */
export function managedDepartmentIds(user: CurrentUser | null): string[] {
  if (!user) return [];
  const ids = new Set<string>();
  for (const r of user.roles) {
    if (r.key === "department_manager" && r.departmentId) ids.add(r.departmentId);
  }
  return [...ids];
}

/** Holds department_manager in at least one department. */
export function isManager(user: CurrentUser | null): boolean {
  return managedDepartmentIds(user).length > 0;
}

/**
 * Can read more than one department's rows. Mirrors the read policies:
 * is_ims() (every IMS-side role, not just ims_admin) or my_department_ids()
 * holding more than one department. Decides whether a list offers its Dept
 * column — a user who only ever sees one department has nothing for it to
 * tell apart.
 */
export function readsManyDepartments(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (isImsView(user)) return true;
  return new Set(user.roles.map((r) => r.departmentId).filter(Boolean)).size > 1;
}

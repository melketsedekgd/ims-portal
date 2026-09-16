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

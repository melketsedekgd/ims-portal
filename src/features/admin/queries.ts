import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin, managedDepartmentIds } from "@/lib/permissions";
import type { Enums } from "@/types/database";

// ── Users ───────────────────────────────────────────────────────────────────

export type UserRoleItem = {
  key: string;
  name: string;
  department: { id: string; code: string; name: string } | null;
};

export type AdminUserItem = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  status: Enums<"profile_status">;
  roles: UserRoleItem[];
};

type ProfileRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  status: Enums<"profile_status">;
  user_roles: {
    roles: { key: string; name: string } | null;
    departments: { id: string; code: string; name: string } | null;
  }[];
};

/**
 * Every profile with its role assignments.
 *
 * DELIBERATE ACTORSHIP FILTER for managers. profiles_select is
 * organisation-wide, so RLS returns everyone; a department manager is
 * shown only the people holding a role in a department they manage. This
 * is what the page is for them, not a permission — an admin sees all.
 */
export async function getAdminUsers(): Promise<AdminUserItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id,
       full_name,
       job_title,
       status,
       user_roles (
         roles ( key, name ),
         departments ( id, code, name )
       )`
    )
    .order("full_name")
    .returns<ProfileRow[]>();
  if (error) throw error;

  const items = (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    jobTitle: p.job_title,
    status: p.status,
    roles: p.user_roles.map((ur) => ({
      key: ur.roles?.key ?? "",
      name: ur.roles?.name ?? "",
      department: ur.departments,
    })),
  }));

  if (isAdmin(user)) return items;

  const managed = new Set(managedDepartmentIds(user));
  return items.filter((u) => u.roles.some((r) => r.department && managed.has(r.department.id)));
}

// ── Departments ─────────────────────────────────────────────────────────────

export type AdminDepartmentItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: Enums<"department_status">;
  /** Distinct people holding any role in the department. */
  userCount: number;
};

type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: Enums<"department_status">;
  user_roles: { profile_id: string }[];
};

/**
 * Every department with how many people hold a role in it. A manager is
 * shown their own — same actorship filter as getAdminUsers, same reason.
 */
export async function getAdminDepartments(): Promise<AdminDepartmentItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code, description, status, user_roles ( profile_id )")
    .order("name")
    .returns<DepartmentRow[]>();
  if (error) throw error;

  const items = (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description,
    status: d.status,
    userCount: new Set(d.user_roles.map((ur) => ur.profile_id)).size,
  }));

  if (isAdmin(user)) return items;

  const managed = new Set(managedDepartmentIds(user));
  return items.filter((d) => managed.has(d.id));
}

/** Active departments, for the role picker. */
export async function getActiveDepartments(): Promise<{ id: string; name: string; code: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// ── Overview ────────────────────────────────────────────────────────────────

export type AdminOverview = {
  activeDepartments: number;
  activeUsers: number;
  /** Distinct role keys with at least one assignment, and the count per key. */
  rolesInUse: { key: string; name: string; count: number }[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient();
  const [departments, profiles, roles] = await Promise.all([
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("user_roles").select("roles ( key, name )").returns<{ roles: { key: string; name: string } | null }[]>(),
  ]);
  if (departments.error) throw departments.error;
  if (profiles.error) throw profiles.error;
  if (roles.error) throw roles.error;

  const byKey = new Map<string, { key: string; name: string; count: number }>();
  for (const ur of roles.data ?? []) {
    if (!ur.roles) continue;
    const entry = byKey.get(ur.roles.key) ?? { key: ur.roles.key, name: ur.roles.name, count: 0 };
    entry.count++;
    byKey.set(ur.roles.key, entry);
  }

  return {
    activeDepartments: departments.count ?? 0,
    activeUsers: profiles.count ?? 0,
    rolesInUse: [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

import { z } from "zod";

/**
 * Roles the UI issues. Not system_admin (break-glass, never issued through
 * the UI); not document_owner or approver (nothing reads them).
 */
export const ISSUABLE_ROLES = [
  { key: "ims_admin",          label: "IMS Administrator", description: "Administers the system across every department.", scoped: false },
  { key: "ims_reviewer",       label: "IMS Reviewer",      description: "Reads every department. Never writes.", scoped: false },
  { key: "department_manager", label: "Department Manager", description: "Edits definitions and reviews document changes in one department.", scoped: true },
  { key: "responsible_user",   label: "Responsible User",  description: "Records measurements and raises change requests in one department.", scoped: true },
  { key: "viewer",             label: "Viewer / Auditor",  description: "Organisation-wide read access. Cannot be scoped to a department.", scoped: false },
] as const;

export type IssuableRoleKey = (typeof ISSUABLE_ROLES)[number]["key"];
const roleKeys = ISSUABLE_ROLES.map((r) => r.key) as [IssuableRoleKey, ...IssuableRoleKey[]];

export const isDepartmentScoped = (key: string) =>
  ISSUABLE_ROLES.some((r) => r.key === key && r.scoped);

export const createUserSchema = z
  .object({
    email: z.email("A valid email is required"),
    fullName: z.string().trim().min(1, "Full name is required"),
    jobTitle: z.string().trim().optional(),
    roleKey: z.enum(roleKeys),
    departmentId: z.uuid().optional().or(z.literal("")),
    temporaryPassword: z.string().min(8, "Temporary password must be at least 8 characters"),
  })
  .superRefine((u, ctx) => {
    if (isDepartmentScoped(u.roleKey)) {
      if (!u.departmentId) {
        ctx.addIssue({ code: "custom", path: ["departmentId"], message: "This role needs a department" });
      }
    } else if (u.departmentId) {
      // A department-scoped viewer passes my_department_ids() and could
      // write measurements. Org-wide roles carry no department.
      ctx.addIssue({ code: "custom", path: ["departmentId"], message: "This role is organisation-wide and takes no department" });
    }
  });

export type CreateUserInput = z.input<typeof createUserSchema>;

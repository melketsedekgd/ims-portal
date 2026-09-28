import type { ColumnRegistry } from "@/lib/columns";

/**
 * The admin tables' columns: each table and its Columns panel read these,
 * in this order. The row-action column is not listed — it is always there
 * and never chosen. Every column is on by default, so Default and Detailed
 * are the same set.
 */
export const ADMIN_USER_COLUMN_KEYS = ["user", "roles", "status"] as const;

export type AdminUserColumnKey = (typeof ADMIN_USER_COLUMN_KEYS)[number];

export const ADMIN_USER_COLUMNS: ColumnRegistry<AdminUserColumnKey> = {
  tableKey: "admin_users",
  columns: [
    { key: "user", label: "User", locked: true, exportWidth: 32 },
    { key: "roles", label: "Roles", exportWidth: 44 },
    { key: "status", label: "Status", exportWidth: 12 },
  ],
  presets: {
    minimal: ["user", "roles"],
    default: ADMIN_USER_COLUMN_KEYS,
    detailed: ADMIN_USER_COLUMN_KEYS,
  },
};

export const ADMIN_DEPARTMENT_COLUMN_KEYS = ["department", "code", "people", "status"] as const;

export type AdminDepartmentColumnKey = (typeof ADMIN_DEPARTMENT_COLUMN_KEYS)[number];

export const ADMIN_DEPARTMENT_COLUMNS: ColumnRegistry<AdminDepartmentColumnKey> = {
  tableKey: "admin_departments",
  columns: [
    { key: "department", label: "Department", locked: true, exportWidth: 36 },
    { key: "code", label: "Code", exportWidth: 10 },
    { key: "people", label: "People", exportWidth: 10 },
    { key: "status", label: "Status", exportWidth: 12 },
  ],
  presets: {
    minimal: ["department", "code", "status"],
    default: ADMIN_DEPARTMENT_COLUMN_KEYS,
    detailed: ADMIN_DEPARTMENT_COLUMN_KEYS,
  },
};

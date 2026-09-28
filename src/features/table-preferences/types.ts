import { KPI_COLUMNS } from "@/features/kpis/columns";
import { RISK_COLUMNS } from "@/features/risks/columns";
import { OBJECTIVE_COLUMNS } from "@/features/objectives/columns";
import { ACTION_COLUMNS } from "@/features/action-items/columns";
import { DOCUMENT_COLUMNS, REQUEST_COLUMNS } from "@/features/documents/columns";
import { ADMIN_DEPARTMENT_COLUMNS, ADMIN_USER_COLUMNS } from "@/features/admin/columns";
import type { ColumnRegistry, TableKey } from "@/lib/columns";

/** user_table_preferences.table_key, and the registry each one saves. */
export const TABLE_REGISTRIES = {
  kpis: KPI_COLUMNS,
  risks: RISK_COLUMNS,
  objectives: OBJECTIVE_COLUMNS,
  actions: ACTION_COLUMNS,
  documents: DOCUMENT_COLUMNS,
  document_requests: REQUEST_COLUMNS,
  admin_users: ADMIN_USER_COLUMNS,
  admin_departments: ADMIN_DEPARTMENT_COLUMNS,
} satisfies Record<TableKey, ColumnRegistry<string>>;

export type { TableKey };

/** Every key, for validating what a client sends. */
export const TABLE_KEYS = Object.keys(TABLE_REGISTRIES) as [TableKey, ...TableKey[]];

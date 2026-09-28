import { KPI_COLUMNS } from "@/features/kpis/columns";
import { RISK_COLUMNS } from "@/features/risks/columns";
import type { ColumnRegistry, TableKey } from "@/lib/columns";

/** user_table_preferences.table_key, and the registry each one saves. */
export const TABLE_REGISTRIES = {
  kpis: KPI_COLUMNS,
  risks: RISK_COLUMNS,
} satisfies Record<TableKey, ColumnRegistry<string>>;

export type { TableKey };

/** Every key, for validating what a client sends. */
export const TABLE_KEYS = Object.keys(TABLE_REGISTRIES) as [TableKey, ...TableKey[]];

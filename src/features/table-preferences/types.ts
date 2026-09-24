import { KPI_COLUMNS } from "@/features/kpis/columns";
import { RISK_COLUMNS } from "@/features/risks/columns";
import type { ColumnRegistry } from "@/lib/columns";

/** user_table_preferences.table_key, and the registry each one saves. */
export const TABLE_REGISTRIES = {
  kpis: KPI_COLUMNS,
  risks: RISK_COLUMNS,
} satisfies Record<string, ColumnRegistry<string>>;

export type TableKey = keyof typeof TABLE_REGISTRIES;

import type { ColumnDef, ColumnRegistry } from "@/lib/columns";
import { KPI_COLUMN_KEYS, KPI_COLUMNS, type KpiColumnKey } from "@/features/kpis/columns";
import { RISK_COLUMN_KEYS, RISK_COLUMNS, type RiskColumnKey } from "@/features/risks/columns";
import type { ShareItemType } from "./types";

/**
 * A shared item's table: the KPI and risk columns, saved under keys of
 * their own so a choice here never changes the viewer's KPI or risk list.
 *
 * Default is the fixed set the share page always showed, so everyone a
 * share was sent to opens it on the same columns; each viewer may then
 * choose their own. Dept has no rule of its own here — a share is a
 * hand-picked list, shown as the export has it — so its note is dropped.
 */
function withoutNotes<K extends string>(columns: readonly ColumnDef<K>[]): ColumnDef<K>[] {
  return columns.map((c) => ({ ...c, note: undefined }));
}

export const SHARED_KPI_COLUMNS: ColumnRegistry<KpiColumnKey> = {
  tableKey: "shared_kpis",
  columns: withoutNotes(KPI_COLUMNS.columns),
  presets: {
    minimal: ["metric", "target", "actual", "status"],
    default: ["metric", "dept", "target", "actual", "status"],
    detailed: KPI_COLUMN_KEYS,
  },
};

export const SHARED_RISK_COLUMNS: ColumnRegistry<RiskColumnKey> = {
  tableKey: "shared_risks",
  columns: withoutNotes(RISK_COLUMNS.columns),
  presets: {
    minimal: ["risk", "score", "band", "status"],
    default: ["risk", "dept", "ref", "ls", "score", "band", "status", "owner"],
    detailed: RISK_COLUMN_KEYS,
  },
};

export const SHARED_COLUMNS: Record<ShareItemType, ColumnRegistry<string>> = {
  kpi: SHARED_KPI_COLUMNS,
  risk: SHARED_RISK_COLUMNS,
};

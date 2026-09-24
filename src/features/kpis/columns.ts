import type { ColumnRegistry } from "@/lib/columns";

/**
 * The KPI tracking table's columns: the table, the Columns panel and the
 * export all read this, in this order. The select and actions columns are
 * not listed — they are always there and never chosen.
 *
 * Dept keeps its own rule on screen: shown only when the list spans more
 * than one department, and only offered in the panel to someone who can
 * see more than one.
 */
export const KPI_COLUMN_KEYS = [
  "metric",
  "dept",
  "responsibility",
  "target",
  "actual",
  "achievement",
  "status",
  "remark",
  "data_source",
  "frequency",
  "methodology",
  "evidence",
] as const;

export type KpiColumnKey = (typeof KPI_COLUMN_KEYS)[number];

export const KPI_COLUMNS: ColumnRegistry<KpiColumnKey> = {
  tableKey: "kpis",
  columns: [
    { key: "metric", label: "Metric", locked: true, exportHeader: "KPI", exportWidth: 44 },
    {
      key: "dept",
      label: "Dept",
      note: "When the list spans departments",
      exportHeader: "Department",
      exportWidth: 12,
    },
    { key: "responsibility", label: "Responsibility", exportWidth: 24 },
    { key: "target", label: "Target", exportWidth: 22 },
    { key: "actual", label: "Actual", exportWidth: 22 },
    { key: "achievement", label: "Achievement", exportWidth: 13 },
    { key: "status", label: "Status", exportWidth: 16 },
    { key: "remark", label: "Remark / justification", exportWidth: 40 },
    { key: "data_source", label: "Data source", extra: true, exportWidth: 28 },
    // measurement_frequency: the report's "Analysis Frequency" column was
    // loaded into it (docs/schema-decisions.md). reporting_frequency is
    // quarterly for every KPI and says nothing per row.
    { key: "frequency", label: "Frequency", extra: true, exportWidth: 14 },
    { key: "methodology", label: "Methodology", extra: true, exportWidth: 44 },
    { key: "evidence", label: "Evidence", extra: true, exportWidth: 24 },
  ],
  presets: {
    minimal: ["metric", "dept", "target", "actual", "status"],
    default: ["metric", "dept", "responsibility", "target", "actual", "achievement", "status", "remark"],
    detailed: KPI_COLUMN_KEYS,
  },
};

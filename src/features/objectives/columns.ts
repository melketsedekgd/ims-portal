import type { ColumnRegistry } from "@/lib/columns";

/**
 * The objectives table's columns: the table and the Columns panel read
 * this, in this order. The actions column is not listed — it is always
 * there and never chosen.
 *
 * Dept keeps its own rule on screen, as on KPIs and risks: shown only when
 * the list spans more than one department, and only offered in the panel
 * to someone who can see more than one.
 */
export const OBJECTIVE_COLUMN_KEYS = [
  "objective",
  "dept",
  "owner",
  "target_date",
  "achievement",
  "status",
] as const;

export type ObjectiveColumnKey = (typeof OBJECTIVE_COLUMN_KEYS)[number];

export const OBJECTIVE_COLUMNS: ColumnRegistry<ObjectiveColumnKey> = {
  tableKey: "objectives",
  columns: [
    { key: "objective", label: "Objective", locked: true, exportWidth: 60 },
    {
      key: "dept",
      label: "Dept",
      note: "When the list spans departments",
      exportHeader: "Department",
      exportWidth: 12,
    },
    { key: "owner", label: "Owner", extra: true, exportWidth: 24 },
    { key: "target_date", label: "Target date", exportWidth: 14 },
    { key: "achievement", label: "Achievement", exportWidth: 14 },
    { key: "status", label: "Status", exportWidth: 12 },
  ],
  presets: {
    minimal: ["objective", "dept", "achievement", "status"],
    default: ["objective", "dept", "target_date", "achievement", "status"],
    detailed: OBJECTIVE_COLUMN_KEYS,
  },
};

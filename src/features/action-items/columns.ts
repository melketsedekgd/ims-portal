import type { ColumnRegistry } from "@/lib/columns";

/**
 * The actions table's columns: the table and the Columns panel read this,
 * in this order. The status-update column is not listed — it is always
 * there and never chosen.
 */
export const ACTION_COLUMN_KEYS = [
  "title",
  "department",
  "source",
  "owner",
  "priority",
  "start",
  "due",
  "progress",
  "status",
] as const;

export type ActionColumnKey = (typeof ACTION_COLUMN_KEYS)[number];

export const ACTION_COLUMNS: ColumnRegistry<ActionColumnKey> = {
  tableKey: "actions",
  columns: [
    { key: "title", label: "Title", locked: true, exportWidth: 44 },
    { key: "department", label: "Department", exportWidth: 20 },
    { key: "source", label: "Source", exportWidth: 18 },
    { key: "owner", label: "Owner", exportWidth: 24 },
    { key: "priority", label: "Priority", exportWidth: 10 },
    { key: "start", label: "Start", extra: true, exportWidth: 14 },
    { key: "due", label: "Due", exportWidth: 14 },
    { key: "progress", label: "Progress", extra: true, exportWidth: 10 },
    { key: "status", label: "Status", exportWidth: 14 },
  ],
  presets: {
    minimal: ["title", "owner", "due", "status"],
    default: ["title", "department", "source", "owner", "priority", "due", "status"],
    detailed: ACTION_COLUMN_KEYS,
  },
};

import type { ColumnRegistry } from "@/lib/columns";

/**
 * The risk register's columns: the table, the Columns panel and the export
 * all read this, in this order. The select and actions columns are not
 * listed — they are always there and never chosen.
 *
 * Dept keeps its own rule on screen: shown only when the list spans more
 * than one department, and only offered in the panel to someone who can
 * see more than one.
 */
export const RISK_COLUMN_KEYS = [
  "risk",
  "dept",
  "ref",
  "ls",
  "score",
  "band",
  "status",
  "owner",
  "affected_assets",
  "threat",
  "vulnerability",
  "treatment",
] as const;

export type RiskColumnKey = (typeof RISK_COLUMN_KEYS)[number];

export const RISK_COLUMNS: ColumnRegistry<RiskColumnKey> = {
  tableKey: "risks",
  columns: [
    { key: "risk", label: "Risk", locked: true, exportWidth: 52 },
    {
      key: "dept",
      label: "Dept",
      note: "When the list spans departments",
      exportHeader: "Department",
      exportWidth: 12,
    },
    // reference_number: a label that restarts per process each quarter,
    // never an identifier.
    { key: "ref", label: "Ref", exportWidth: 6 },
    { key: "ls", label: "L × S", exportWidth: 8 },
    { key: "score", label: "Score", exportWidth: 8 },
    { key: "band", label: "Band", exportWidth: 13 },
    { key: "status", label: "Status", exportWidth: 20 },
    { key: "owner", label: "Owner", exportWidth: 24 },
    { key: "affected_assets", label: "Affected assets", extra: true, exportWidth: 28 },
    // Null on every SRD risk: their historical form has no such column.
    { key: "threat", label: "Threat", extra: true, exportWidth: 32 },
    { key: "vulnerability", label: "Vulnerability", extra: true, exportWidth: 32 },
    { key: "treatment", label: "Treatment", extra: true, exportWidth: 44 },
  ],
  presets: {
    minimal: ["risk", "dept", "score", "status"],
    default: ["risk", "dept", "ls", "score", "status"],
    detailed: RISK_COLUMN_KEYS,
  },
};

import type { ExportColumn } from "@/lib/export/download";

/**
 * Chosen columns for a list table, and the presets they can match.
 *
 * Each table keeps one registry (features/<module>/columns.ts) that the
 * table, the Columns panel and the export all read, so what is on screen
 * and what is in the file cannot list different columns. A registry is
 * plain data: safe to import from server and client alike.
 *
 * A saved choice is a list of keys. It is always passed through
 * resolveColumns() before use, so a key a later release removes is
 * dropped, a locked column is always there, and order is the registry's
 * whatever order the keys were saved in.
 */

export type PresetName = "minimal" | "default" | "detailed";

export const PRESETS: { value: PresetName; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "default", label: "Default" },
  { value: "detailed", label: "Detailed" },
];

export type ColumnDef<K extends string> = {
  key: K;
  /** The table header and the panel's checkbox label. */
  label: string;
  /** Always shown; checked and disabled in the panel. */
  locked?: boolean;
  /** Listed under "More details" in the panel. */
  extra?: boolean;
  /** Muted text beside the checkbox, for a column with a rule of its own. */
  note?: string;
  /** The file's header when it differs from the label ("Dept" → "Department"). */
  exportHeader?: string;
  /** Excel column width in characters; the PDF scales these to the page. */
  exportWidth: number;
};

export type ColumnRegistry<K extends string> = {
  /** user_table_preferences.table_key. */
  tableKey: "kpis" | "risks";
  /** Registry order is table order and file order. */
  columns: readonly ColumnDef<K>[];
  presets: Record<PresetName, readonly K[]>;
};

export function isColumnKey<K extends string>(
  registry: ColumnRegistry<K>,
  key: string
): key is K {
  return registry.columns.some((c) => c.key === key);
}

/**
 * A saved choice as the table uses it. null — nothing saved — is Default.
 * Unknown keys are ignored and locked keys added back, so a registry
 * change never breaks an old save.
 */
export function resolveColumns<K extends string>(
  registry: ColumnRegistry<K>,
  saved: readonly string[] | null
): K[] {
  if (saved === null) return [...registry.presets.default];
  const chosen = new Set(saved);
  return registry.columns
    .filter((c) => c.locked || chosen.has(c.key))
    .map((c) => c.key);
}

/** Ticks or unticks one column, keeping registry order. Locked columns stay. */
export function toggleColumn<K extends string>(
  registry: ColumnRegistry<K>,
  keys: readonly K[],
  key: K,
  on: boolean
): K[] {
  const next = new Set(keys);
  if (on) next.add(key);
  else next.delete(key);
  return resolveColumns(registry, [...next]);
}

/** The preset the choice equals exactly, or null for a custom set. */
export function matchingPreset<K extends string>(
  registry: ColumnRegistry<K>,
  keys: readonly K[]
): PresetName | null {
  const chosen = new Set(keys);
  for (const { value } of PRESETS) {
    const preset = registry.presets[value];
    if (preset.length === chosen.size && preset.every((k) => chosen.has(k))) return value;
  }
  return null;
}

/**
 * Every file opens with the process. The table always shows it too, as
 * the header row each group of rows sits under; a flat file has no group
 * rows, so it is a column — never listed in the panel, like the table's
 * select and actions columns.
 */
export const PROCESS_EXPORT_COLUMN = { header: "Process", key: "process", width: 28 } as const;

/** A row as the export actions build it: every column's text, plus the id. */
export type ExportRow<K extends string> = { id: string } & Record<K | "process", string>;

/** A row as an export returns it: only the columns written, plus the id for links. */
export type ExportedRow<K extends string> = { id: string } & Partial<Record<K | "process", string>>;

/** The file's columns for a choice: Process, then the chosen ones in registry order. */
export function exportColumnsFor<K extends string>(
  registry: ColumnRegistry<K>,
  keys: readonly string[]
): ExportColumn<ExportedRow<K>>[] {
  const chosen = new Set(resolveColumns(registry, keys));
  return [
    PROCESS_EXPORT_COLUMN,
    ...registry.columns
      .filter((c) => chosen.has(c.key))
      .map((c) => ({ header: c.exportHeader ?? c.label, key: c.key, width: c.exportWidth })),
  ];
}

/** Just the columns written, so the action returns nothing the file does not hold. */
export function pickColumns<K extends string>(
  row: ExportRow<K>,
  columns: readonly ExportColumn<ExportedRow<K>>[]
): ExportedRow<K> {
  // Built as plain strings: TypeScript cannot narrow a generic key's type.
  const source: Record<string, string> = row;
  const picked: Record<string, string> = { id: row.id };
  for (const c of columns) picked[c.key] = source[c.key];
  return picked as ExportedRow<K>;
}

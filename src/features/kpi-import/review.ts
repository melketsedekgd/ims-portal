import type { Enums } from "@/types/database";

/**
 * Pure rules for staged rows, shared by staging, the row edits and the
 * review screen. No client or server imports.
 */

/** A KPI name as it is matched: whitespace collapsed, trimmed, lower case. */
export function normaliseName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Why a staged row needs checking. Stored in import_rows.issue as these
 * codes; commit_import adds its own 'already_recorded' on skipped rows.
 */
export const ISSUE_TEXT: Record<string, string> = {
  no_match: "No KPI in this department has this name. Pick the KPI this row belongs to, or exclude it.",
  ambiguous_name: "More than one KPI in this department has this name. Pick the right one.",
  duplicate_kpi: "Another row in the sheet matches the same KPI. Keep one and exclude the others.",
  no_value: "The result cell is empty. Enter a value, mark it N/A, or exclude the row.",
  unparsed_value: "The result could not be read as a number. Enter the value and unit.",
  unit_mismatch: "The unit doesn't measure the same thing as the KPI's target. Change it, or pick another KPI.",
  already_recorded: "A result was already recorded for this quarter and Replace was not ticked, so it was kept.",
};

export type RowStatus = Enums<"import_row_status">;

/** units.key → dimension ("time", "ratio", "count"). */
export type UnitDimensions = ReadonlyMap<string, string>;

/**
 * Whether a unit can be scored against a target unit. kpi_achievement_ratio
 * converts within a dimension (min against hr is fine) and returns null
 * across dimensions, which would leave the KPI Pending.
 */
export function unitFits(
  unit: string | null,
  targetUnit: string | null,
  dims: UnitDimensions
): boolean {
  if (!unit || !targetUnit) return true;
  return dims.get(unit) === dims.get(targetUnit);
}

/**
 * How a bare number in a percentage KPI's result cell is written:
 * "fraction" is 0.95 for 95%, "whole" is 95. Chosen once per import.
 */
export type PercentScale = "fraction" | "whole";

/**
 * The scale most of these bare percentage values are written in. Values
 * strictly between 0 and 1 count for "fraction", above 1 for "whole"; 0 and
 * 1 read the same both ways (1 could be 1% or 100%) and count for neither.
 * "whole" when nothing decides it.
 */
export function guessPercentScale(values: readonly number[]): {
  scale: PercentScale;
  fraction: number;
  whole: number;
} {
  const fraction = values.filter((v) => v > 0 && v < 1).length;
  const whole = values.filter((v) => v > 1).length;
  return { scale: fraction > whole ? "fraction" : "whole", fraction, whole };
}

/** A bare percentage value in percent units, as stored: 0.9729 → 97.29. */
export function toPercent(value: number, scale: PercentScale): number {
  return scale === "fraction" ? Number((value * 100).toPrecision(12)) : value;
}

import type { Enums } from "@/types/database";

/**
 * Pure helpers shared by the KPI form (live preview) and the mutation
 * (what is stored). No client or server imports, so either side can use it.
 */

const DIRECTION_SYMBOL: Record<Enums<"target_direction">, string> = {
  higher_is_better: "≥ ",
  lower_is_better: "≤ ",
  exact: "",
};

/**
 * The target the way a report writes it, from the three fields used to
 * score it: "≥ 95%", "≤ 10", "≤ 3 hours", "≤ 1 day", "≥ 10 story points".
 *
 * The seed KPIs carried target_text transcribed from real reports; for a
 * KPI created in the app it is composed here, never typed, so the list's
 * text and the scoring fields cannot disagree.
 *
 *   percent  value followed directly by "%"
 *   count    the bare value
 *   others   value, a space, the unit's label from `units`; a value of
 *            exactly 1 drops the label's trailing "s" ("1 day", not
 *            "1 days")
 *
 * The value is rendered as entered — 99.9 stays "99.9", 95 stays "95".
 */
export function formatTargetText(
  direction: Enums<"target_direction">,
  value: number,
  unit: string,
  unitLabel: string
): string {
  const symbol = DIRECTION_SYMBOL[direction];
  const number = String(value);
  if (unit === "percent") return `${symbol}${number}%`;
  if (unit === "count") return `${symbol}${number}`;
  const label =
    value === 1 && unitLabel.endsWith("s") ? unitLabel.slice(0, -1) : unitLabel;
  return `${symbol}${number} ${label}`;
}

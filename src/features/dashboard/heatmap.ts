/**
 * The company heatmap's cut-offs, in one place.
 *
 * Four measures, four different scales, one vocabulary. They live together
 * rather than next to the cells that render them for the same reason
 * riskBand() lives on its own in features/risks/scoring.ts: a threshold
 * copied into a second component drifts, and the two screens then disagree
 * about the same department while both look right.
 *
 * Pure — no React, no queries — so a plain node script can exercise the
 * boundaries.
 */

export type Band = "good" | "warn" | "bad" | "neutral";

/**
 * A percentage, 0–100, or null when nothing was measured.
 *
 * Null is neutral, not zero. A department that measured no KPIs has not
 * scored 0% — it has no score, and a red cell would accuse it of failing
 * something it never attempted. Callers convert the 0..1 fractions the
 * database stores before calling this; the thresholds are written in the
 * units Melke approved them in.
 */
export function bandPercent(pct: number | null): Band {
  if (pct === null) return "neutral";
  if (pct >= 80) return "good";
  if (pct >= 50) return "warn";
  return "bad";
}

/**
 * Critical risks, against how many active risks went unassessed.
 *
 * Any unassessed risk makes the count neutral. "0 critical" is only good
 * news when every risk was actually looked at; with three never assessed
 * it means nobody checked, and a green 0 would say the opposite of what
 * happened. IT in Q1 2026 is exactly this case — one risk assessed out of
 * twelve.
 */
export function bandCriticalRisks(critical: number, notAssessed: number): Band {
  if (notAssessed > 0) return "neutral";
  if (critical === 0) return "good";
  if (critical <= 2) return "warn";
  return "bad";
}

/** Overdue actions, counted right now rather than per quarter. */
export function bandOverdueActions(count: number): Band {
  if (count === 0) return "good";
  if (count <= 3) return "warn";
  return "bad";
}

/**
 * A 0..1 fraction as a whole-number percentage, or null.
 *
 * One place so the heatmap, the totals and the charts round identically —
 * 0.6511 is 65% everywhere or the cards and the table disagree by a point.
 */
export function asPercent(fraction: number | null): number | null {
  return fraction === null ? null : Math.round(fraction * 100);
}

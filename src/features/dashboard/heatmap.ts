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
 * A measured percentage that may still be being typed.
 *
 * A quarter still open is a quarter still arriving, and a score over part
 * of it is not a verdict on the department. IT's Q3 objectives were 100%
 * — of the one row out of four that had been entered. The number was
 * right and the colour was a lie, so while the period is open the cell is
 * only coloured once everything due has been entered.
 *
 * A closed period is final: whatever is in it is all there will ever be,
 * so it colours on the figures as they stand.
 */
export function bandMeasuredPercent(
  pct: number | null,
  entered: number,
  due: number,
  periodOpen: boolean
): Band {
  if (pct === null) return "neutral";
  if (periodOpen && entered < due) return "neutral";
  return bandPercent(pct);
}

/**
 * Critical risks, against the register behind them.
 *
 * Neutral in two cases, both of which are "there is no verdict here"
 * rather than "this is fine":
 *
 *  - No active risks at all. A department with an empty register has not
 *    achieved zero critical risks; it has not started one. Finance, IMS
 *    and Marketing are all in this position today.
 *  - Any active risk left unassessed this quarter. "0 critical" is only
 *    good news when every risk was actually looked at; IT in Q1 had one
 *    assessment across twelve risks, and a green 0 would say the opposite
 *    of what happened.
 */
export function bandCriticalRisks(
  critical: number,
  notAssessed: number,
  risksActive: number
): Band {
  if (risksActive === 0) return "neutral";
  if (notAssessed > 0) return "neutral";
  if (critical === 0) return "good";
  if (critical <= 2) return "warn";
  return "bad";
}

/**
 * Overdue actions, counted right now rather than per quarter.
 *
 * A department with no open actions has nothing to be late with, so it
 * gets no colour. Nought overdue out of a real list of open work is a
 * genuine green — the difference is whether anyone was keeping a list.
 */
export function bandOverdueActions(overdue: number, openActions: number): Band {
  if (openActions === 0) return "neutral";
  if (overdue === 0) return "good";
  if (overdue <= 3) return "warn";
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

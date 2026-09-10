/**
 * Risk score banding.
 *
 * Pure — no server or client dependencies — so both the register table and the
 * period snapshot can import it. The thresholds existed only inside the
 * register's getScoreColor before; a second copy in the reporting query is
 * exactly the kind of duplicate that drifts silently and makes two screens
 * disagree about the same risk.
 */
export type RiskBand = "critical" | "medium" | "low" | "not_assessed";

/**
 * A risk with no residual assessment for the selected period has no score.
 *
 * The null test is explicit and comes first, before any comparison. Relying on
 * comparison behaviour is what produced the OverviewCards bug: `null < 5` is
 * true in JavaScript, so every unassessed risk was counted as Low while the
 * `>= 15` and `>= 5` tests correctly rejected it — a null fell through to
 * exactly the wrong bucket, and on Q3 2026 that rendered 12 unassessed risks
 * as "12 Low" on a green chip.
 */
export function riskBand(score: number | null): RiskBand {
  if (score === null) return "not_assessed";
  if (score >= 15) return "critical";
  if (score >= 5) return "medium";
  return "low";
}

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  critical: "Critical",
  medium: "Medium",
  low: "Low",
  not_assessed: "Not assessed",
};

/** The bands that carry a real score, for callers that style them. */
export type ScoredRiskBand = Exclude<RiskBand, "not_assessed">;

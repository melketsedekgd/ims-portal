/**
 * Risk score banding.
 *
 * Pure — no server or client dependencies — so both the register table and the
 * period snapshot can import it. The thresholds existed only inside the
 * register's getScoreColor before; a second copy in the reporting query is
 * exactly the kind of duplicate that drifts silently and makes two screens
 * disagree about the same risk.
 */
export type RiskBand = "critical" | "medium" | "low";

export function riskBand(score: number): RiskBand {
  if (score >= 15) return "critical";
  if (score >= 5) return "medium";
  return "low";
}

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  critical: "Critical",
  medium: "Medium",
  low: "Low",
};

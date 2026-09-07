export type RiskStatus =
  | "Open"
  | "Under Review"
  | "Treated"
  | "Closed";

export interface RiskState {
  severity: number;
  likelihood: number;
}

export interface Risk {
  id: string;

  // Table fields
  assets: string;
  threat: string;
  vulnerability: string;
  treatment: string;
  department: string;
  status: RiskStatus;

  // Risk assessment
  current: RiskState;
  residual: RiskState;

  // Additional information
  group: string;
  statement: string;
  dateStarting: string;
  dateFinishing: string;
  evidenceMonitoring: string;
  owner: string;
  effectiveness: RiskEffectiveness;
  evidenceSolutions: string | null;
  reasonForDeviation: string | null;
  followupMeasure: string | null;
}

export type RiskEffectiveness =
  | "Maintain"
  | "Correction"
  | "Corrective Action";

export interface NewRiskInput {
  group: string;
  assets: string;
  threat: string;
  vulnerability: string;
  treatment: string;
  department: string;
  status: RiskStatus;
  statement: string;

  currentSeverity: number;
  currentLikelihood: number;

  dateStarting: string;
  dateFinishing: string;
  evidenceMonitoring: string;

  residualSeverity: number;
  residualLikelihood: number;

  owner: string;
  effectiveness: RiskEffectiveness;

  evidenceSolutions: string;
  reasonForDeviation: string;
  followupMeasure: string;
}

export function rpn(state: RiskState): number {
  return state.severity * state.likelihood;
}

export function riskLevel(
  value: number
): "low" | "medium" | "high" | "critical" {
  if (value <= 4) return "low";
  if (value <= 9) return "medium";
  if (value <= 16) return "high";
  return "critical";
}
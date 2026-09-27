import { z } from "zod";

/**
 * A residual risk rating for one risk in one reporting period.
 *
 * severity and likelihood are bounded 1–5 by the valid_severity and
 * valid_likelihood CHECK constraints on risk_assessments; the ranges here
 * match those, so a bad value is rejected before the round trip. rpn is
 * not accepted: it is a generated column (severity * likelihood) and the
 * database refuses a client-supplied value.
 */
const rating = z
  .number()
  .int("Whole numbers only")
  .min(1, "Rate from 1 to 5")
  .max(5, "Rate from 1 to 5");

export const riskAssessmentSchema = z.object({
  riskId: z.uuid(),
  reportingPeriodId: z.uuid(),
  severity: rating,
  likelihood: rating,
  notes: z.string().optional(),
});

export type RiskAssessmentInput = z.input<typeof riskAssessmentSchema>;
export type RiskAssessment = z.output<typeof riskAssessmentSchema>;

const optionalText = z.string().trim().optional();

/**
 * A new risk and its baseline rating, as create_risk_with_baseline() takes
 * them. reference_number is not accepted: the function assigns it. The
 * ratings have no default — a starting score nobody picked would be saved
 * as the risk's baseline.
 */
export const riskDefinitionSchema = z.object({
  departmentId: z.uuid("Choose a department"),
  /** null when the risk sits under no process. */
  processId: z.uuid().nullable().default(null),
  affectedAssets: z.string().trim().min(1, "A risk needs affected assets"),
  threat: optionalText,
  vulnerability: optionalText,
  riskStatement: optionalText,
  riskOwnerTitle: optionalText,
  severity: rating,
  likelihood: rating,
});

export type RiskDefinitionInput = z.input<typeof riskDefinitionSchema>;
export type RiskDefinition = z.output<typeof riskDefinitionSchema>;

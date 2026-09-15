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

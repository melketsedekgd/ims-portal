import { z } from "zod";
import type { Enums } from "@/types/database";

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

/** The treatment_effectiveness enum, in the order the dialog offers it. */
export const treatmentEffectivenessValues = [
  "maintain",
  "correction",
  "corrective_action",
] as const satisfies readonly Enums<"treatment_effectiveness">[];

/**
 * One quarter's review of a risk, as record_risk_review() takes it: the
 * residual score, and — when the risk has a treatment — that treatment's
 * review for the same period.
 *
 * `treatment` is null exactly when the risk has no treatment that is not
 * cancelled; the function refuses a review in either mismatched case. Any
 * answer but Maintain needs a reason and a follow-up, as in the function.
 */
export const riskReviewSchema = z
  .object({
    riskId: z.uuid(),
    reportingPeriodId: z.uuid(),
    severity: rating,
    likelihood: rating,
    notes: optionalText,
    treatment: z
      .object({
        treatmentId: z.uuid(),
        effectiveness: z.enum(treatmentEffectivenessValues, "Choose whether the treatment is working"),
        solutionEvidence: optionalText,
        reasonForDeviation: optionalText,
        followupMeasure: optionalText,
      })
      .nullable(),
  })
  .superRefine((r, ctx) => {
    const t = r.treatment;
    if (!t || t.effectiveness === "maintain") return;
    if (!t.reasonForDeviation) {
      ctx.addIssue({
        code: "custom",
        path: ["treatment", "reasonForDeviation"],
        message: "Say why the treatment isn't going to plan",
      });
    }
    if (!t.followupMeasure) {
      ctx.addIssue({
        code: "custom",
        path: ["treatment", "followupMeasure"],
        message: "Say what will be done about it",
      });
    }
  });

export type RiskReviewInput = z.input<typeof riskReviewSchema>;
export type RiskReview = z.output<typeof riskReviewSchema>;
/** An <input type="date"> yields "" when cleared; both mean "no date". */
const optionalDate = z.iso.date().optional().or(z.literal(""));

/**
 * The statuses a treatment can start in. 'completed' and 'cancelled' are
 * reached from the risk's page; create_risk_with_baseline() refuses them.
 */
export const newTreatmentStatuses = ["planned", "in_progress"] as const;
export type NewTreatmentStatus = (typeof newTreatmentStatuses)[number];

/**
 * A new risk, its baseline rating and its treatment, as
 * create_risk_with_baseline() takes them. reference_number is not accepted:
 * the function assigns it. The ratings have no default — a starting score
 * nobody picked would be saved as the risk's baseline. The treatment is
 * required: every risk on the reports has one, and there is no "accept the
 * risk" option.
 */
export const riskDefinitionSchema = z
  .object({
    departmentId: z.uuid("Choose a department"),
    /** null when the risk sits under no process. */
    processId: z.uuid().nullable().default(null),
    /** Stored as one comma-separated text column; createRisk joins it. */
    affectedAssets: z
      .array(z.string().trim().min(1, "An asset can't be blank"))
      .min(1, "Add at least one affected asset"),
    threat: optionalText,
    vulnerability: optionalText,
    riskStatement: optionalText,
    riskOwnerTitle: optionalText,
    severity: rating,
    likelihood: rating,
    treatmentSolution: z.string().trim().min(1, "Describe how the risk will be reduced"),
    monitoringEvidence: optionalText,
    treatmentOwnerTitle: optionalText,
    treatmentStart: optionalDate,
    treatmentTarget: z.iso.date("Choose a target date"),
    treatmentStatus: z.enum(newTreatmentStatuses).default("planned"),
  })
  .superRefine((r, ctx) => {
    // Also the valid_dates CHECK on risk_treatments. ISO dates compare
    // correctly as strings.
    if (r.treatmentStart && r.treatmentTarget < r.treatmentStart) {
      ctx.addIssue({
        code: "custom",
        path: ["treatmentTarget"],
        message: "The target date can't be before the start date",
      });
    }
  });

export type RiskDefinitionInput = z.input<typeof riskDefinitionSchema>;
export type RiskDefinition = z.output<typeof riskDefinitionSchema>;

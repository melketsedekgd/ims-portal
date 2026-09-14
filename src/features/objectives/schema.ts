import { z } from "zod";

/**
 * One objective measurement for one reporting period.
 *
 * achievement is 0–1 (the valid_achievement CHECK) and is only meaningful
 * for an objective with no activities — SRD's are entered from the report.
 * For an objective with activities the snapshot trigger overwrites it from
 * the live counts, so the action does not send it at all. Counts are never
 * accepted: they are derived, never client-supplied.
 */
export const objectiveMeasurementSchema = z
  .object({
    objectiveId: z.uuid(),
    reportingPeriodId: z.uuid(),
    achievement: z
      .number()
      .min(0, "Achievement must be between 0 and 1")
      .max(1, "Achievement must be between 0 and 1")
      .nullable(),
    notMeasured: z.boolean().default(false),
    evidenceReference: z.string().optional(),
    reasonForDeviation: z.string().optional(),
    followupAction: z.string().optional(),
  })
  .superRefine((m, ctx) => {
    // "Not measured" is a distinct state, not a value of zero.
    if (m.notMeasured && m.achievement !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["achievement"],
        message: "An objective marked not measured cannot have an achievement",
      });
    }
  });

export type ObjectiveMeasurementInput = z.input<typeof objectiveMeasurementSchema>;
export type ObjectiveMeasurement = z.output<typeof objectiveMeasurementSchema>;

/**
 * Progress on one activity. 'cancelled' is deliberately absent: cancelling
 * drops the activity from the denominator, which is a definition change and
 * a manager's — guard_activity_definition() enforces it, and the app never
 * offers it.
 */
export const activityStatusSchema = z.object({
  activityId: z.uuid(),
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export type ActivityStatusInput = z.input<typeof activityStatusSchema>;

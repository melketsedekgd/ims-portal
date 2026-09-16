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

// ── Objective definition ─────────────────────────────────────────────────────

const optionalText = z.string().trim().optional();
/** An <input type="date"> yields "" when cleared; both mean "no date". */
const optionalDate = z.iso.date().optional().or(z.literal(""));

/**
 * One activity on a new objective. status is not accepted: the column
 * defaults to not_started and a new activity has no other honest value.
 * display_order is the row's position in the array, not a field.
 */
export const objectiveActivitySchema = z.object({
  title: z.string().trim().min(1, "Every activity needs a title"),
  description: optionalText,
  ownerTitle: optionalText,
  plannedStartDate: optionalDate,
  plannedCompletionDate: optionalDate,
});

/**
 * How the objective scores. This is the choice the form must make explicit:
 *
 *   activities  achievement is completed ÷ total and is never typed; each
 *               measurement snapshots the counts so a past report stays
 *               reproducible. At least one activity is required.
 *   direct      no activities; a percentage is entered each period. Every
 *               SRD objective works this way.
 *
 * The database infers the mode from whether activities exist, so a form
 * that silently created zero activities would drop the objective into
 * direct entry without anyone choosing it.
 */
export const objectiveScoringModes = ["activities", "direct"] as const;
export type ObjectiveScoringMode = (typeof objectiveScoringModes)[number];

export const objectiveDefinitionSchema = z
  .object({
    departmentId: z.uuid("Choose a department"),
    /** null when the objective sits under no process — allowed by design. */
    processId: z.uuid().nullable().default(null),
    title: z.string().trim().min(1, "Title is required"),
    description: optionalText,
    ownerTitle: optionalText,
    startDate: optionalDate,
    targetDate: optionalDate,
    mode: z.enum(objectiveScoringModes, { error: "Choose how the objective is scored" }),
    activities: z.array(objectiveActivitySchema).default([]),
  })
  .superRefine((o, ctx) => {
    if (o.mode === "activities" && o.activities.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["activities"],
        message: "An objective scored by activities needs at least one activity",
      });
    }
    if (o.mode === "direct" && o.activities.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["activities"],
        message: "A directly entered objective cannot have activities",
      });
    }
    if (o.startDate && o.targetDate && o.targetDate < o.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Target date cannot be before the start date",
      });
    }
  });

export type ObjectiveDefinitionInput = z.input<typeof objectiveDefinitionSchema>;
export type ObjectiveDefinition = z.output<typeof objectiveDefinitionSchema>;

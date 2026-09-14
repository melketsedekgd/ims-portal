import { z } from "zod";

/**
 * One KPI measurement for one reporting period.
 *
 * Deliberately narrow. target_value / target_unit / target_direction are
 * snapshotted by a BEFORE INSERT trigger, and achievement_override & friends
 * are manager-only and rejected by a trigger for everyone else — neither set
 * belongs on the entry form, so neither is accepted here.
 */
export const kpiMeasurementSchema = z
  .object({
    kpiId: z.uuid(),
    reportingPeriodId: z.uuid(),
    actualValue: z.number().nullable(),
    actualText: z.string().optional(),
    notMeasured: z.boolean().default(false),
    remark: z.string().optional(),
    evidenceReference: z.string().optional(),
  })
  .superRefine((m, ctx) => {
    // "Not measured" is a distinct state, not a value of zero — a number
    // alongside it would be contradictory, and averages exclude these rows.
    if (m.notMeasured && m.actualValue !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["actualValue"],
        message: "A KPI marked not measured cannot have an actual value",
      });
    }
  });

export type KpiMeasurementInput = z.input<typeof kpiMeasurementSchema>;
export type KpiMeasurement = z.output<typeof kpiMeasurementSchema>;

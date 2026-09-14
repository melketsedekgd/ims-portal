import { z } from "zod";
import { Constants } from "@/types/database";

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

// ── KPI definition ───────────────────────────────────────────────────────────

const { period_type, target_direction, aggregation_method } =
  Constants.public.Enums;

const optionalText = z.string().trim().optional();

/**
 * A new KPI definition.
 *
 * target_text, target_value and target_unit are nullable in the table but
 * required here. snapshot_measurement_target() copies them onto every new
 * measurement, and kpi_achievement_ratio() needs all three: a KPI created
 * without them renders Pending forever with no way to repair it from the UI.
 *
 * The three enums are read from database.ts rather than restated, so a
 * migration that adds a value cannot leave this schema rejecting it.
 */
export const kpiDefinitionSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: optionalText,
  departmentId: z.uuid(),
  processId: z.uuid("Choose a process"),
  targetText: z.string().trim().min(1, "Target text is required"),
  targetValue: z.coerce.number({ error: "Target value must be a number" }),
  targetUnit: z.string().min(1, "Choose a unit"),
  targetDirection: z.enum(target_direction),
  measurementFrequency: z.enum(period_type),
  reportingFrequency: z.enum(period_type).default("quarterly"),
  aggregationMethod: z.enum(aggregation_method).default("average"),
  dataSource: optionalText,
  analysisMethodology: optionalText,
  responsibilityTitle: optionalText,
});

/**
 * The same schema with target_unit checked against the keys in `units`.
 * target_unit is a foreign key; a value not in the list would fail with
 * 23503 after the round trip instead of here.
 */
export function kpiDefinitionSchemaFor(unitKeys: readonly string[]) {
  return kpiDefinitionSchema.refine((k) => unitKeys.includes(k.targetUnit), {
    path: ["targetUnit"],
    message: "Choose a unit from the list",
  });
}

export type KpiDefinitionInput = z.input<typeof kpiDefinitionSchema>;
export type KpiDefinition = z.output<typeof kpiDefinitionSchema>;

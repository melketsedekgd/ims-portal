import { z } from "zod";
import { IMPORT_FIELDS } from "./types";

/** What staging needs besides the file itself. columnMap holds display header names. */
export const stageImportSchema = z.object({
  departmentId: z.uuid(),
  periodId: z.uuid(),
  sheet: z.string().min(1),
  headerRow: z.coerce.number().int().min(1),
  columnMap: z
    .object({
      kpi_name: z.string().min(1, "Choose the KPI name column"),
      actual: z.string().min(1, "Choose the result column"),
      remark: z.string().optional(),
      evidence: z.string().optional(),
    })
    .refine(
      (m) => {
        const used = IMPORT_FIELDS.map((f) => m[f]).filter(Boolean);
        return new Set(used).size === used.length;
      },
      { message: "Each column can be used for one field only" }
    ),
});

export type StageImportInput = z.input<typeof stageImportSchema>;

/** A reviewer's correction to one staged row. */
export const reviewRowSchema = z
  .object({
    kpiId: z.uuid("Pick the KPI this row belongs to"),
    actualValue: z.number().nullable(),
    actualUnit: z.string().min(1).nullable(),
    notMeasured: z.boolean(),
  })
  .refine((r) => r.notMeasured || r.actualValue !== null, {
    path: ["actualValue"],
    message: "Enter a numeric result, or mark the row N/A",
  });

export type ReviewRowInput = z.input<typeof reviewRowSchema>;

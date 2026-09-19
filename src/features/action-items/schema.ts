import { z } from "zod";
import { Constants } from "@/types/database";

const { action_source, action_status } = Constants.public.Enums;

/**
 * A new action against the actions table (Epic 6) — not the mixed
 * activity/treatment feed in queries.ts's ActionItem, which this schema has
 * nothing to do with.
 *
 * source_type/source_id are set by whichever entrance created the action: a
 * risk, KPI or objective detail page pre-fills both from the record it's
 * on; the standalone list page leaves source_type at 'other' with no id.
 * Mirrors the DB's source_id_iff_not_other check so a bad combination fails
 * here with a field-level message instead of a raw constraint error.
 */
export const createActionSchema = z
  .object({
    departmentId: z.uuid(),
    sourceType: z.enum(action_source),
    sourceId: z.uuid().nullable(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional(),
    ownerTitle: z.string().trim().optional(),
    priority: z.coerce.number().int().min(1).max(3).optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
  })
  .superRefine((a, ctx) => {
    if (a.sourceType === "other" && a.sourceId !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceId"],
        message: "An action with no source record cannot carry a source id",
      });
    }
    if (a.sourceType !== "other" && a.sourceId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceId"],
        message: "A source record is required for this source type",
      });
    }
  });

export type CreateActionInput = z.input<typeof createActionSchema>;
export type CreateActionData = z.output<typeof createActionSchema>;

/**
 * Status/progress update. completed_date is required exactly when the new
 * status is 'completed' — a flip to completed with no date would lose
 * "since when", and a date on any other status would be a stale leftover
 * from a previous completion that got reopened.
 */
export const updateActionStatusSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(action_status),
    completionPercentage: z.coerce.number().int().min(0).max(100).optional(),
    completedDate: z.string().optional(),
  })
  .superRefine((a, ctx) => {
    if (a.status === "completed" && !a.completedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["completedDate"],
        message: "Completed date is required when marking an action complete",
      });
    }
    if (a.status !== "completed" && a.completedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["completedDate"],
        message: "Completed date only applies when status is completed",
      });
    }
  });

export type UpdateActionStatusInput = z.input<typeof updateActionStatusSchema>;
export type UpdateActionStatusData = z.output<typeof updateActionStatusSchema>;

import { z } from "zod";
import { Constants, type Enums } from "@/types/database";

const { action_status } = Constants.public.Enums;

/**
 * The source types a new action can point at: an item, or one of its
 * quarterly rows. Never 'other' — every action belongs to something
 * (actions_source_required) — and never a bare treatment or another
 * action, which the New action dialog does not offer.
 */
export const ACTION_LINK_SOURCE_TYPES = [
  "risk",
  "risk_treatment_review",
  "kpi",
  "kpi_measurement",
  "objective",
  "objective_measurement",
  "document_change",
] as const satisfies readonly Enums<"action_source">[];

export type ActionLinkSourceType = (typeof ACTION_LINK_SOURCE_TYPES)[number];

export const MISSING_LINK_MESSAGE =
  "Choose what this action is related to: a risk, KPI, objective or document change.";

/**
 * A new action against the actions table (Epic 6).
 *
 * No department: the server derives department_id from the linked item,
 * never from the client.
 */
export const createActionSchema = z.object({
  sourceType: z.enum(ACTION_LINK_SOURCE_TYPES, { error: MISSING_LINK_MESSAGE }),
  sourceId: z.uuid({ error: MISSING_LINK_MESSAGE }),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  ownerTitle: z.string().trim().optional(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

export type CreateActionInput = z.input<typeof createActionSchema>;
export type CreateActionData = z.output<typeof createActionSchema>;

/**
 * An edit from the update dialog: the action's own fields. source and
 * department are not editable — what an action belongs to is fixed when
 * it is created.
 *
 * completed_date is required exactly when the new status is 'completed' —
 * a flip to completed with no date would lose "since when", and a date on
 * any other status would be a stale leftover from a previous completion
 * that got reopened.
 */
export const updateActionSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1, "Title is required"),
    ownerTitle: z.string().trim().optional(),
    priority: z.coerce.number().int().min(1).max(3).optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    status: z.enum(action_status),
    completionPercentage: z.coerce
      .number()
      .int("Completion must be a whole number")
      .min(0, "Completion must be between 0 and 100")
      .max(100, "Completion must be between 0 and 100")
      .optional(),
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

export type UpdateActionInput = z.input<typeof updateActionSchema>;
export type UpdateActionData = z.output<typeof updateActionSchema>;

import { z } from "zod";

const required = (what: string) => z.string().trim().min(1, `${what} is required`);
const optionalText = z.string().trim().optional();

/** A new change request. Submitted straight to pending_owner; no draft in the UI yet. */
export const changeRequestSchema = z.object({
  documentId: z.uuid(),
  proposedRevision: required("Proposed revision"),
  reasonForChange: required("Reason for change"),
  descriptionOfChange: required("Description of change"),
  affectedProcesses: optionalText,
  relatedIsoRequirements: optionalText,
  proposedEffectiveDate: z.iso.date().optional().or(z.literal("")),
});

export type ChangeRequestInput = z.input<typeof changeRequestSchema>;

/**
 * A reviewer's decision. A rejection needs a reason — the
 * rejection_needs_reason CHECK enforces it too, but refusing here spares
 * the round trip.
 */
export const decisionSchema = z
  .object({
    requestId: z.uuid(),
    stage: z.enum(["owner", "ims"]),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.decision === "rejected" && !d.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "A reason is required to reject" });
    }
  });

export type DecisionInput = z.input<typeof decisionSchema>;

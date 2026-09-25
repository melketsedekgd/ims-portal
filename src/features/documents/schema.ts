import { z } from "zod";

const required = (what: string) => z.string().trim().min(1, `${what} is required`);
const optionalText = z.string().trim().optional();

/**
 * A new change request. Submitted straight to pending_owner; no draft in
 * the UI yet. Either names an existing document (documentId) or brings a
 * new one into the system (documentName + departmentId); the document row
 * is a byproduct of the first request raised against it.
 */
export const changeRequestSchema = z
  .object({
    documentId: z.uuid().optional().or(z.literal("")),
    documentName: z.string().trim().optional(),
    departmentId: z.uuid().optional().or(z.literal("")),
    documentNumber: optionalText,
    storageUrl: z.url({ message: "Storage URL must be a full link (https://…)" }).optional().or(z.literal("")),
    proposedRevision: required("Proposed revision"),
    reasonForChange: required("Reason for change"),
    descriptionOfChange: required("Description of change"),
    affectedProcesses: optionalText,
    relatedIsoRequirements: optionalText,
    proposedEffectiveDate: z.iso.date().optional().or(z.literal("")),
  })
  .superRefine((r, ctx) => {
    if (r.documentId) return;
    if (!r.documentName) {
      ctx.addIssue({ code: "custom", path: ["documentName"], message: "Pick a document or name a new one" });
    }
    if (!r.departmentId) {
      ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Department is required" });
    }
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
    stage: z.enum(["owner", "ims", "coordinator_review", "draft_check", "ims_document", "final"]),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.decision === "rejected" && !d.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "A reason is required to reject" });
    }
  });

export type DecisionInput = z.input<typeof decisionSchema>;

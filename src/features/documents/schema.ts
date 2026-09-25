import { z } from "zod";

const required = (what: string) => z.string().trim().min(1, `${what} is required`);
const optionalText = z.string().trim().optional();

/**
 * A new change request. Submitted straight to pending_owner; no draft in
 * the UI yet. requestType decides the shape: "new" names a document that
 * does not exist yet (documentName + departmentId); "revision" and
 * "deletion" both name an existing one (documentId). The document row for
 * a new document is a byproduct of the first request raised against it.
 * proposedRevision is required unless the request is a deletion — there is
 * nothing to label a document that is going away.
 */
export const changeRequestSchema = z
  .object({
    requestType: z.enum(["new", "revision", "deletion"]),
    documentId: z.uuid().optional().or(z.literal("")),
    documentName: z.string().trim().optional(),
    departmentId: z.uuid().optional().or(z.literal("")),
    documentNumber: optionalText,
    documentType: optionalText,
    storageUrl: z.url({ message: "Storage URL must be a full link (https://…)" }).optional().or(z.literal("")),
    supportingFileUrl: z.url({ message: "Supporting file link must be a full link (https://…)" }).optional().or(z.literal("")),
    proposedRevision: optionalText,
    reasonForChange: required("Reason for change"),
    descriptionOfChange: required("Description of change"),
    affectedProcesses: optionalText,
    relatedIsoRequirements: optionalText,
    proposedEffectiveDate: z.iso.date().optional().or(z.literal("")),
  })
  .superRefine((r, ctx) => {
    if (r.requestType === "new") {
      if (!r.documentName) {
        ctx.addIssue({ code: "custom", path: ["documentName"], message: "Name the new document" });
      }
      if (!r.departmentId) {
        ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Department is required" });
      }
    } else if (!r.documentId) {
      ctx.addIssue({ code: "custom", path: ["documentId"], message: "Pick a document" });
    }
    if (r.requestType !== "deletion" && !r.proposedRevision) {
      ctx.addIssue({ code: "custom", path: ["proposedRevision"], message: "Proposed revision is required" });
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

/** Document control publishing a new document or revision. */
export const publishSchema = z.object({
  requestId: z.uuid(),
  revisionLabel: required("Revision"),
  documentNumber: optionalText,
  fileUrl: z.url({ message: "The final file needs a full link (https://…)" }).optional().or(z.literal("")),
  effectiveDate: z.iso.date().optional().or(z.literal("")),
});

export type PublishInput = z.input<typeof publishSchema>;

/** Document control retiring a document approved for deletion. */
export const retireSchema = z.object({
  requestId: z.uuid(),
});

export type RetireInput = z.input<typeof retireSchema>;

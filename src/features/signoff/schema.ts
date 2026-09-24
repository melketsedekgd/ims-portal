import { z } from "zod";

/**
 * The shape of a decision as it arrives from a form. Nothing here decides
 * who may do what — record_quarter_decision() does that, and duplicating it
 * would give two answers to drift apart. This only catches what the RPC
 * cannot express as a type: a return with no reason behind it.
 */
export const decisionSchema = z
  .object({
    departmentId: z.string().uuid(),
    periodId: z.string().uuid(),
    decision: z.enum(["submit", "return", "approve", "receive"]),
    reason: z.string().optional(),
  })
  .refine(
    (d) => d.decision !== "return" || (d.reason ?? "").trim().length > 0,
    { path: ["reason"], message: "A reason is required to return a quarter." }
  );

export type DecisionInput = z.infer<typeof decisionSchema>;

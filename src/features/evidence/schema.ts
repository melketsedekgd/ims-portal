import { z } from "zod";
import { Constants } from "@/types/database";

const { action_source, evidence_type } = Constants.public.Enums;

/**
 * New evidence attached to a risk, KPI measurement, objective, action, etc.
 * departmentId is deliberately absent: the mutation resolves it server-side
 * via department_of(linkedType, linkedId) rather than trusting a
 * client-supplied value, so there is nothing here for a caller to fake.
 */
export const addEvidenceSchema = z.object({
  linkedType: z.enum(action_source),
  linkedId: z.uuid(),
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(evidence_type),
  location: z.string().trim().optional(),
});

export type AddEvidenceInput = z.input<typeof addEvidenceSchema>;
export type AddEvidenceData = z.output<typeof addEvidenceSchema>;

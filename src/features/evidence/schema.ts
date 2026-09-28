import { z } from "zod";
import { Constants } from "@/types/database";
import { INVALID_URL_MESSAGE, parseHttpUrl, withScheme } from "./url";

const { action_source, evidence_type } = Constants.public.Enums;

/**
 * New evidence attached to a risk, KPI measurement, objective, action, etc.
 * departmentId is deliberately absent: the mutation resolves it server-side
 * via department_of(linkedType, linkedId) rather than trusting a
 * client-supplied value, so there is nothing here for a caller to fake.
 *
 * A link's location must be an http(s) URL — the evidence_link_is_url
 * constraint says the same, this just says it first and in words. A bare
 * "github.com/org/repo" gets https:// added, and an empty name defaults to
 * the host name.
 */
export const addEvidenceSchema = z
  .object({
    linkedType: z.enum(action_source),
    linkedId: z.uuid(),
    name: z.string().trim(),
    type: z.enum(evidence_type),
    location: z.string().trim().optional(),
  })
  .transform((e, ctx) => {
    if (e.type !== "link") {
      if (e.name === "") {
        ctx.addIssue({ code: "custom", message: "Name is required", path: ["name"] });
        return z.NEVER;
      }
      return e;
    }

    if (!e.location) {
      ctx.addIssue({ code: "custom", message: "A link needs a URL.", path: ["location"] });
      return z.NEVER;
    }
    const url = parseHttpUrl(withScheme(e.location));
    if (!url) {
      ctx.addIssue({ code: "custom", message: INVALID_URL_MESSAGE, path: ["location"] });
      return z.NEVER;
    }
    return { ...e, location: url.href, name: e.name || url.hostname };
  });

export type AddEvidenceInput = z.input<typeof addEvidenceSchema>;
export type AddEvidenceData = z.output<typeof addEvidenceSchema>;

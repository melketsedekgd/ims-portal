import { z } from "zod";

/**
 * A process added from a form's process select. create_process() trims the
 * name and rejects a blank one too; this gives the dialog its field message
 * without a round trip.
 */
export const processInputSchema = z.object({
  departmentId: z.uuid(),
  name: z.string().trim().min(1, "Give the process a name"),
  governingDocument: z.string().trim().optional(),
});

export type ProcessInput = z.input<typeof processInputSchema>;

/**
 * A unit added from a units select. Mirrors create_unit()'s rules, which
 * remain the authority:
 *
 *   key        1–16 characters, no spaces (unique ignoring case: checked by
 *              the dialog against the list it has, and by the function)
 *   factor     > 0 and not 1 when joining a dimension (1 would be a second
 *              base unit); ignored for a new dimension, which is stored as 1
 */
export const unitInputSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, "Give the unit a symbol")
      .max(16, "A symbol is at most 16 characters")
      .regex(/^\S+$/, "A symbol can't contain spaces"),
    label: z.string().trim().min(1, "Give the unit a name"),
    dimension: z.string().trim().min(1, "Choose what the unit measures"),
    newDimension: z.boolean(),
    factor: z.number().optional(),
  })
  .superRefine((u, ctx) => {
    if (u.newDimension) return;
    if (u.factor === undefined || !Number.isFinite(u.factor) || u.factor <= 0) {
      ctx.addIssue({ code: "custom", path: ["factor"], message: "Enter a number greater than 0" });
    } else if (u.factor === 1) {
      ctx.addIssue({
        code: "custom",
        path: ["factor"],
        message: "1 would make it the same as the base unit",
      });
    }
  });

export type UnitInput = z.input<typeof unitInputSchema>;

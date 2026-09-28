"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProcessOption, UnitOption } from "@/features/kpis/queries";
import {
  processInputSchema,
  unitInputSchema,
  type ProcessInput,
  type UnitInput,
} from "./schema";

// ── Processes ────────────────────────────────────────────────────────────────

export type CreateProcessResult =
  | { ok: true; process: ProcessOption }
  | { ok: false; message: string };

/**
 * Add an active process at the end of a department's list, from the
 * "+ Add process…" option of a KPI, risk or objective form.
 *
 * create_process() is security invoker, so processes_insert decides who may:
 * the IMS Manager, or a manager of that department. No department filter
 * here — the dialog is only offered where the insert would pass, and RLS is
 * the authority either way.
 */
export async function createProcess(input: ProcessInput): Promise<CreateProcessResult> {
  const parsed = processInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the process details." };
  }
  const { departmentId, name, governingDocument } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_process", {
    p_department_id: departmentId,
    p_name: name,
    p_governing_document: governingDocument || undefined,
  });

  if (error) {
    return { ok: false, message: await createProcessMessage(error, name, departmentId) };
  }

  return {
    ok: true,
    process: { id: data.id, name: data.name, departmentId: data.department_id },
  };
}

/**
 * Postgres errors create_process() can raise.
 *
 *   23505  An active process of that name exists in the department, ignoring
 *          case and surrounding spaces (processes_name_active_idx).
 *   42501  processes_insert refused: not the IMS Manager, and not a manager
 *          of this department.
 *   23514  A blank name; the function's message is already a sentence.
 */
async function createProcessMessage(
  error: { code: string; message: string },
  name: string,
  departmentId: string
): Promise<string> {
  switch (error.code) {
    case "23505": {
      const supabase = await createClient();
      const { data } = await supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .maybeSingle();
      return `A process named "${name}" already exists in ${data?.name ?? "this department"}.`;
    }
    case "42501":
      return "You don't have permission to add a process to this department.";
    default:
      return error.message;
  }
}

// ── Units ────────────────────────────────────────────────────────────────────

export type CreateUnitResult =
  | { ok: true; unit: UnitOption }
  | { ok: false; message: string };

/**
 * Add a unit from the "+ Add unit…" option of a units select.
 *
 * create_unit() is security invoker: units_insert lets the IMS Manager and
 * any department manager add one. Joining an existing dimension takes a
 * factor to its base unit; a new dimension makes this unit its base, and the
 * function stores factor 1 whatever is sent.
 */
export async function createUnit(input: UnitInput): Promise<CreateUnitResult> {
  const parsed = unitInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the unit details." };
  }
  const { key, label, dimension, newDimension, factor } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_unit", {
    p_key: key,
    p_label: label,
    p_dimension: dimension,
    p_factor: newDimension ? 1 : (factor as number),
    p_new_dimension: newDimension,
  });

  if (error) return { ok: false, message: createUnitMessage(error) };

  return {
    ok: true,
    unit: {
      key: data.key,
      label: data.label,
      dimension: data.dimension,
      factorToBase: data.factor_to_base,
    },
  };
}

/**
 * Postgres errors on units.
 *
 *   unit_in_use  guard_unit_in_use (42501): the unit is referenced, and only
 *                its label may change. Checked before the plain 42501.
 *   23505        The symbol exists, ignoring case.
 *   42501        units_insert refused: not the IMS Manager or a manager.
 *   23514        create_unit()'s own checks (symbol shape, a missing or
 *                existing dimension, a factor of 0 or 1); already sentences.
 */
function createUnitMessage(error: { code: string; message: string }): string {
  if (error.message.startsWith("unit_in_use")) {
    return "This unit is used by KPIs and can't be changed.";
  }
  switch (error.code) {
    case "23505":
      return "A unit with that symbol already exists.";
    case "42501":
      return "You don't have permission to add a unit.";
    default:
      return error.message;
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, TablesInsert } from "@/types/database";
import {
  objectiveMeasurementSchema,
  activityStatusSchema,
  objectiveDefinitionSchema,
  type ObjectiveMeasurementInput,
  type ActivityStatusInput,
  type ObjectiveDefinitionInput,
} from "./schema";
import { todayInAddisAbaba } from "./dates";

export type ObjectiveWriteResult =
  | { ok: true }
  | { ok: false; message: string };

/** Empty or whitespace-only text clears the column rather than storing "". */
const textOrNull = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Today as YYYY-MM-DD in UTC, matching how the periods queries compare dates. */
const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Create or replace the measurement for one objective in one period.
 *
 * Upserts on (objective_id, reporting_period_id). For an objective with
 * activities, achievement is not sent: snapshot_objective_measurement()
 * overwrites it and both counts from the live rows, and the client must
 * not be able to say otherwise. For one without, the client's achievement
 * is the figure. No department filter — RLS decides.
 */
export async function saveObjectiveMeasurement(
  input: ObjectiveMeasurementInput
): Promise<ObjectiveWriteResult> {
  const parsed = objectiveMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid measurement",
    };
  }
  const m = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to record a measurement." };
  }

  // Same test the trigger and objective_achievement() use: at least one
  // non-cancelled activity means the counts are the authority.
  const { count: activityCount, error: countError } = await supabase
    .from("objective_activities")
    .select("id", { count: "exact", head: true })
    .eq("objective_id", m.objectiveId)
    .neq("status", "cancelled");
  if (countError) {
    return { ok: false, message: countError.message };
  }
  const derived = (activityCount ?? 0) > 0;

  const row: TablesInsert<"objective_measurements"> = {
    objective_id: m.objectiveId,
    reporting_period_id: m.reportingPeriodId,
    not_measured: m.notMeasured,
    recorded_by: user.id,
    recorded_at: new Date().toISOString(),
  };
  if (!derived) row.achievement = m.notMeasured ? null : m.achievement;
  // Optional text is three-valued: undefined leaves the column as it is on an
  // existing row, "" clears it, anything else replaces it.
  if (m.evidenceReference !== undefined) row.evidence_reference = textOrNull(m.evidenceReference);
  if (m.reasonForDeviation !== undefined) row.reason_for_deviation = textOrNull(m.reasonForDeviation);
  if (m.followupAction !== undefined) row.followup_action = textOrNull(m.followupAction);

  const { error } = await supabase
    .from("objective_measurements")
    .upsert(row, { onConflict: "objective_id,reporting_period_id" });

  if (error) {
    return { ok: false, message: friendlyMessage(error) };
  }

  revalidatePath("/department/objectives");
  return { ok: true };
}

/**
 * Move one activity between not_started / in_progress / completed.
 * completed_date follows the status: set on completion, cleared otherwise.
 * The definition columns are untouched, so guard_activity_definition() only
 * fires for a caller who cannot mark progress at all.
 */
export async function setActivityStatus(
  input: ActivityStatusInput
): Promise<ObjectiveWriteResult> {
  const parsed = activityStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid activity status",
    };
  }
  const a = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("objective_activities")
    .update({
      status: a.status,
      completed_date: a.status === "completed" ? todayUtc() : null,
    })
    .eq("id", a.activityId)
    .select("id");

  if (error) {
    return { ok: false, message: friendlyMessage(error) };
  }
  // RLS hides rows it refuses rather than erroring on UPDATE: zero rows
  // means the activity is not the caller's to change.
  if (!data || data.length === 0) {
    return { ok: false, message: "You do not have permission to update this activity." };
  }

  revalidatePath("/department/objectives");
  return { ok: true };
}

/**
 * Postgres errors the dialog can hit, translated for the toast.
 *
 *   42501 from guard_activity_definition() carries its own sentence
 *         ("Only a department manager or an IMS admin may …") — keep it.
 *   42501 from RLS is the bare "new row violates row-level security policy"
 *         — a closed period, another department, or a reviewer.
 */
function friendlyMessage(error: { code: string; message: string }): string {
  if (error.code === "42501") {
    return error.message.startsWith("Only ")
      ? error.message
      : "You do not have permission to record this for this period.";
  }
  return error.message;
}

// ── Objective definitions ────────────────────────────────────────────────────

export type CreateObjectiveResult =
  | { ok: true }
  | { ok: false; message: string };

type CreateObjectiveArgs =
  Database["public"]["Functions"]["create_objective_with_activities"]["Args"];

/**
 * Create an objective and its activities, then redirect to its detail page.
 *
 * One RPC, not two inserts: create_objective_with_activities() runs both in
 * a single transaction, so a refused or failed activity insert rolls the
 * objective back with it. Two calls would leave an objective with zero
 * activities — silently in direct-entry mode, which nobody chose — and
 * there is no delete policy to undo it with. The function is security
 * invoker, so objectives_insert and objective_activities_insert still
 * apply as this user, and created_by is their auth.uid().
 *
 * The mode is enforced by the schema: "activities" needs at least one row,
 * "direct" sends none. reference_number is assigned in the function
 * (max + 1 within the department).
 *
 * owner_title and start_date are derived here, not taken from the client:
 * the objective belongs to its department, so its owner is that
 * department's manager (see departmentOwnerTitle), and it starts the day
 * it is created, on the Addis Ababa calendar. The RPC signature is
 * unchanged — both still travel as p_owner_title and p_start_date.
 *
 * On success this never resolves: redirect() throws to perform the
 * navigation, which is why it runs after every early return rather than
 * inside a try block that would catch and report it as an error.
 */
export async function createObjective(
  input: ObjectiveDefinitionInput
): Promise<CreateObjectiveResult> {
  const parsed = objectiveDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid objective",
    };
  }
  const o = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to create an objective." };
  }

  const ownerTitle = await departmentOwnerTitle(supabase, o.departmentId, user.id);
  if (!ownerTitle.ok) return ownerTitle;

  // The generated Args type has every parameter as a non-null string —
  // Postgres cannot declare nullability on a function argument, and the
  // function takes null for the optionals and for "no process".
  const args: { [K in keyof CreateObjectiveArgs]: CreateObjectiveArgs[K] | null } = {
    p_department_id: o.departmentId,
    p_process_id: o.processId,
    p_title: o.title,
    p_description: textOrNull(o.description),
    p_owner_title: ownerTitle.title,
    p_start_date: todayInAddisAbaba(),
    p_target_date: o.targetDate || null,
    // Keys are the function's jsonb contract, snake_case; the array order
    // is the display order.
    p_activities: o.activities.map((a) => ({
      title: a.title,
      description: textOrNull(a.description),
      owner_title: textOrNull(a.ownerTitle),
      planned_start_date: a.plannedStartDate || null,
      planned_completion_date: a.plannedCompletionDate || null,
    })),
  };

  const { data: objectiveId, error } = await supabase.rpc(
    "create_objective_with_activities",
    args as unknown as CreateObjectiveArgs
  );

  if (error) {
    return { ok: false, message: createObjectiveMessage(error) };
  }

  revalidatePath("/department/objectives");
  redirect(`/department/objectives/${objectiveId}`);
}

type OwnerTitleResult = { ok: true; title: string } | { ok: false; message: string };

/** A profile's title for display: the job title when set, else the name. */
const titleOf = (p: { job_title: string | null; full_name: string }) =>
  p.job_title?.trim() || p.full_name;

/**
 * Who an objective in this department is owned by.
 *
 * The profile holding department_manager for the department — job_title
 * if set, else full_name. Several managers: the one whose user_roles row
 * is earliest. No manager: the creating user's own job_title, else
 * full_name, so the column is never null while a creator exists.
 *
 * user_roles, roles and profiles are readable to any signed-in user, so
 * this works for an admin creating in a department they hold no role in.
 * The role is looked up by key first rather than joined with !inner —
 * two small reads, and the department filter stays on user_roles itself.
 */
async function departmentOwnerTitle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  creatorId: string
): Promise<OwnerTitleResult> {
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("key", "department_manager")
    .maybeSingle();
  if (roleError) return { ok: false, message: roleError.message };

  if (role) {
    const { data: manager, error: managerError } = await supabase
      .from("user_roles")
      .select("profiles ( job_title, full_name )")
      .eq("role_id", role.id)
      .eq("department_id", departmentId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      // profile_id → profiles is many-to-one; the generated type says array.
      .overrideTypes<{ profiles: { job_title: string | null; full_name: string } | null }>();
    if (managerError) return { ok: false, message: managerError.message };
    if (manager?.profiles) return { ok: true, title: titleOf(manager.profiles) };
  }

  const { data: creator, error: creatorError } = await supabase
    .from("profiles")
    .select("job_title, full_name")
    .eq("id", creatorId)
    .maybeSingle();
  if (creatorError) return { ok: false, message: creatorError.message };
  if (!creator) {
    return { ok: false, message: "Your profile could not be found; the objective was not created." };
  }
  return { ok: true, title: titleOf(creator) };
}

/**
 * Postgres errors the create form can hit.
 *
 *   42501  objectives_insert refused the department.
 *   23514  The function's own checks (a blank title). The message is
 *          already a sentence.
 *   P0001  guard_objective_process_department(): the process belongs to
 *          another department. The dropdown filters by department so this
 *          is unreachable from the form; translated in case it isn't.
 */
function createObjectiveMessage(error: { code: string; message: string }): string {
  switch (error.code) {
    case "42501":
      return "Only a department manager or IMS admin can create an objective.";
    case "23514":
      return error.message;
    case "P0001":
      return error.message.startsWith("Objective belongs to department")
        ? "The selected process belongs to a different department."
        : error.message;
    default:
      return error.message;
  }
}

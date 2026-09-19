import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/**
 * Open work across the two tables that actually record it: the activities an
 * objective decomposes into, and the treatments planned against a risk.
 *
 * Deliberately NOT period-scoped. Both tables hold standing work with its own
 * dates rather than a per-quarter snapshot, so this list stays the same when
 * the dashboard's period picker moves. Outstanding work does not become
 * un-outstanding because you looked at last quarter.
 */
export type ActionItemKind = "activity" | "treatment";

export type ActionItem = {
  id: string;
  kind: ActionItemKind;
  /** What has to be done. */
  title: string;
  /** The objective or risk it belongs to. */
  parentTitle: string;
  ownerTitle: string | null;
  /** planned_completion_date for activities, target_date for treatments. */
  dueDate: string | null;
  statusLabel: string;
  href: string;
};

type ActivityRow = {
  id: string;
  title: string;
  owner_title: string | null;
  status: "not_started" | "in_progress";
  planned_completion_date: string | null;
  objectives: { id: string; title: string } | null;
};

type TreatmentRow = {
  id: string;
  treatment_solution: string;
  owner_title: string | null;
  status: "planned" | "in_progress";
  target_date: string | null;
  risks: {
    id: string;
    affected_assets: string;
    threat: string | null;
    risk_statement: string | null;
  } | null;
};

const ACTIVITY_STATUS: Record<ActivityRow["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
};

const TREATMENT_STATUS: Record<TreatmentRow["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
};

// Undated work sorts last rather than first. A missing target date is not an
// urgent one.
const dueOrder = (d: string | null) =>
  d === null ? Number.POSITIVE_INFINITY : Date.parse(d);

export async function getOpenActionItems(limit = 8): Promise<ActionItem[]> {
  const supabase = await createClient();

  // RLS scopes both through their parent (activity -> objective -> department,
  // treatment -> risk -> department), so there is no department filter here.
  const [activities, treatments] = await Promise.all([
    supabase
      .from("objective_activities")
      .select(
        `id,
         title,
         owner_title,
         status,
         planned_completion_date,
         objectives ( id, title )`
      )
      .in("status", ["not_started", "in_progress"])
      .returns<ActivityRow[]>(),
    supabase
      .from("risk_treatments")
      .select(
        `id,
         treatment_solution,
         owner_title,
         status,
         target_date,
         risks ( id, affected_assets, threat, risk_statement )`
      )
      .in("status", ["planned", "in_progress"])
      .returns<TreatmentRow[]>(),
  ]);

  if (activities.error) throw activities.error;
  if (treatments.error) throw treatments.error;

  const items: ActionItem[] = [
    ...(activities.data ?? []).map((a) => ({
      id: a.id,
      kind: "activity" as const,
      title: a.title,
      parentTitle: a.objectives?.title ?? "Unlinked objective",
      ownerTitle: a.owner_title,
      dueDate: a.planned_completion_date,
      statusLabel: ACTIVITY_STATUS[a.status],
      href: a.objectives ? `/department/objectives/${a.objectives.id}` : "/department/objectives",
    })),
    ...(treatments.data ?? []).map((t) => ({
      id: t.id,
      kind: "treatment" as const,
      title: t.treatment_solution,
      // Same fallback chain the risk register uses for a risk's title.
      parentTitle:
        t.risks?.risk_statement ??
        t.risks?.threat ??
        t.risks?.affected_assets ??
        "Unlinked risk",
      ownerTitle: t.owner_title,
      dueDate: t.target_date,
      statusLabel: TREATMENT_STATUS[t.status],
      href: t.risks ? `/department/risks/${t.risks.id}` : "/department/risks",
    })),
  ];

  return items
    .sort(
      (a, b) =>
        dueOrder(a.dueDate) - dueOrder(b.dueDate) || a.title.localeCompare(b.title)
    )
    .slice(0, limit);
}

// =============================================================
// The actions table (Epic 6) — manually created, assigned work.
// Unrelated to ActionItem/getOpenActionItems above, which reads
// objective_activities and risk_treatments instead.
// =============================================================

export type Action = {
  id: string;
  departmentId: string;
  departmentName: string | null;
  sourceType: Enums<"action_source">;
  sourceId: string | null;
  title: string;
  description: string | null;
  ownerTitle: string | null;
  priority: number | null;
  startDate: string | null;
  dueDate: string | null;
  status: Enums<"action_status">;
  completionPercentage: number | null;
  completedDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// department_name only exists on the view; direct actions reads join
// departments for it instead, so this row shape is shared by both.
type ActionRow = {
  id: string;
  department_id: string;
  department_name: string | null;
  source_type: Enums<"action_source">;
  source_id: string | null;
  title: string;
  description: string | null;
  owner_title: string | null;
  priority: number | null;
  start_date: string | null;
  due_date: string | null;
  status: Enums<"action_status">;
  completion_percentage: number | null;
  completed_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toAction(r: ActionRow): Action {
  return {
    id: r.id,
    departmentId: r.department_id,
    departmentName: r.department_name,
    sourceType: r.source_type,
    sourceId: r.source_id,
    title: r.title,
    description: r.description,
    ownerTitle: r.owner_title,
    priority: r.priority,
    startDate: r.start_date,
    dueDate: r.due_date,
    status: r.status,
    completionPercentage: r.completion_percentage,
    completedDate: r.completed_date,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const ACTIONS_SELECT = `id, department_id, departments ( name ), source_type, source_id,
  title, description, owner_title, priority, start_date, due_date, status,
  completion_percentage, completed_date, created_by, created_at, updated_at`;

type ActionsSelectRow = Omit<ActionRow, "department_name"> & {
  departments: { name: string } | null;
};

function toActionFromJoin(r: ActionsSelectRow): Action {
  return toAction({ ...r, department_name: r.departments?.name ?? null });
}

/**
 * Open actions, soonest due first. Reads v_open_action_items so the
 * security_invoker RLS scoping and the completed/cancelled exclusion live
 * in one place (the view), not duplicated here.
 */
export async function getOpenActions(limit?: number): Promise<Action[]> {
  const supabase = await createClient();

  let query = supabase
    .from("v_open_action_items")
    .select(
      `id, department_id, department_name, source_type, source_id, title,
       description, owner_title, priority, start_date, due_date, status,
       completion_percentage, completed_date, created_by, created_at, updated_at`
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query.returns<ActionRow[]>();
  if (error) throw error;
  return (data ?? []).map(toAction);
}

/** Every action regardless of status, for the actions list page. */
export async function getActions(): Promise<Action[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("actions")
    .select(ACTIONS_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<ActionsSelectRow[]>();

  if (error) throw error;
  return (data ?? []).map(toActionFromJoin);
}

/** Actions created from a specific risk, KPI, objective, etc. */
export async function getActionsForSource(
  sourceType: Enums<"action_source">,
  sourceId: string
): Promise<Action[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("actions")
    .select(ACTIONS_SELECT)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false })
    .returns<ActionsSelectRow[]>();

  if (error) throw error;
  return (data ?? []).map(toActionFromJoin);
}

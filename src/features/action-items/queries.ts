import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

// =============================================================
// The actions table (Epic 6) — manually created, assigned work.
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
 * A row from v_open_action_items — NOT an actions-table row. The view is a
 * three-way union (actions, risk_treatments, objective_activities), so this
 * has none of the actions-only columns (completion_percentage, created_by,
 * timestamps, ...); only real actions carry priority/description, null for
 * the other two kinds by nature.
 */
export type OpenActionKind = "action" | "risk_treatment" | "objective_activity";

export type OpenAction = {
  kind: OpenActionKind;
  id: string;
  departmentId: string;
  departmentName: string | null;
  title: string;
  ownerTitle: string | null;
  dueDate: string | null;
  /** Cast to text in the view — three different source enums. */
  status: string;
  /** 'risk' | 'objective' | the action's own source_type. */
  parentType: string;
  parentId: string | null;
  priority: number | null;
  description: string | null;
};

type OpenActionRow = {
  kind: string;
  id: string;
  department_id: string;
  department_name: string | null;
  title: string;
  owner_title: string | null;
  due_date: string | null;
  status: string;
  parent_type: string;
  parent_id: string | null;
  priority: number | null;
  description: string | null;
};

function toOpenAction(r: OpenActionRow): OpenAction {
  return {
    kind: r.kind as OpenActionKind,
    id: r.id,
    departmentId: r.department_id,
    departmentName: r.department_name,
    title: r.title,
    ownerTitle: r.owner_title,
    dueDate: r.due_date,
    status: r.status,
    parentType: r.parent_type,
    parentId: r.parent_id,
    priority: r.priority,
    description: r.description,
  };
}

/**
 * Open work across all three sources the view unions, soonest due first.
 * Reads v_open_action_items so the security_invoker RLS scoping and the
 * per-source status filtering live in one place (the view), not duplicated
 * here. Only kind='action' rows can be edited through the actions
 * mutations — a risk_treatment or objective_activity row is not an action
 * and has no updateActionStatus path.
 */
export async function getOpenActions(limit?: number): Promise<OpenAction[]> {
  const supabase = await createClient();

  let query = supabase
    .from("v_open_action_items")
    .select(
      "kind, id, department_id, department_name, title, owner_title, due_date, status, parent_type, parent_id, priority, description"
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query.returns<OpenActionRow[]>();
  if (error) throw error;
  return (data ?? []).map(toOpenAction);
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

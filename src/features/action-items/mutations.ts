"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesInsert, TablesUpdate } from "@/types/database";
import {
  createActionSchema,
  MISSING_LINK_MESSAGE,
  updateActionSchema,
  type ActionLinkSourceType,
  type CreateActionInput,
  type UpdateActionInput,
} from "./schema";
import type { ActionItemType, ActionTarget, ActionTargetPeriod } from "./sources";

export type ActionMutationResult = { ok: true } | { ok: false; message: string };

const friendlyMessage: Record<string, string> = {
  "42501": "Only a department manager or IMS admin can create or edit actions.",
};

// The polymorphic department guard (guard_action_source_department) raises a
// plain exception, not a constraint violation, so it has no error code to
// key a lookup off of — matched on message instead.
function messageFor(error: { code: string; message: string }): string {
  if (friendlyMessage[error.code]) return friendlyMessage[error.code];
  if (error.message.includes("does not match")) {
    return "This action's department does not match its source record's department.";
  }
  return error.message;
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Many-to-one embeds come back as objects; the generated types say arrays.
type DepartmentRow = { department_id: string };
type Nested<K extends string, T> = { [key in K]: T | null };

/**
 * The department that owns the linked item, read as the signed-in user —
 * so an item they cannot see resolves to null, the same as one that does
 * not exist. The department is never taken from the client.
 */
async function departmentOfLink(
  supabase: ServerClient,
  type: ActionLinkSourceType,
  id: string
): Promise<string | null> {
  switch (type) {
    case "risk": {
      const { data } = await supabase.from("risks").select("department_id").eq("id", id).limit(1);
      return data?.[0]?.department_id ?? null;
    }
    case "kpi": {
      const { data } = await supabase.from("kpis").select("department_id").eq("id", id).limit(1);
      return data?.[0]?.department_id ?? null;
    }
    case "objective": {
      const { data } = await supabase.from("objectives").select("department_id").eq("id", id).limit(1);
      return data?.[0]?.department_id ?? null;
    }
    case "risk_treatment_review": {
      const { data } = await supabase
        .from("risk_treatment_reviews")
        .select("risk_treatments ( risks ( department_id ) )")
        .eq("id", id)
        .limit(1)
        .returns<Nested<"risk_treatments", Nested<"risks", DepartmentRow>>[]>();
      return data?.[0]?.risk_treatments?.risks?.department_id ?? null;
    }
    case "kpi_measurement": {
      const { data } = await supabase
        .from("kpi_measurements")
        .select("kpis ( department_id )")
        .eq("id", id)
        .limit(1)
        .returns<Nested<"kpis", DepartmentRow>[]>();
      return data?.[0]?.kpis?.department_id ?? null;
    }
    case "objective_measurement": {
      const { data } = await supabase
        .from("objective_measurements")
        .select("objectives ( department_id )")
        .eq("id", id)
        .limit(1)
        .returns<Nested<"objectives", DepartmentRow>[]>();
      return data?.[0]?.objectives?.department_id ?? null;
    }
    case "document_change": {
      const { data } = await supabase
        .from("document_change_requests")
        .select("documents ( department_id )")
        .eq("id", id)
        .limit(1)
        .returns<Nested<"documents", DepartmentRow>[]>();
      return data?.[0]?.documents?.department_id ?? null;
    }
  }
}

/**
 * Creates an action related to an item or one of its quarterly rows. A
 * missing link is refused here with a clear message, before the database's
 * actions_source_required would refuse it with a raw one.
 */
export async function createAction(input: CreateActionInput): Promise<ActionMutationResult> {
  if (!input?.sourceType || !input?.sourceId) {
    return { ok: false, message: MISSING_LINK_MESSAGE };
  }
  const parsed = createActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action" };
  }
  const a = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to create an action." };
  }

  const departmentId = await departmentOfLink(supabase, a.sourceType, a.sourceId);
  if (!departmentId) {
    return {
      ok: false,
      message: "The item this action is related to was not found, or you do not have access to it.",
    };
  }

  const row: TablesInsert<"actions"> = {
    department_id: departmentId,
    source_type: a.sourceType,
    source_id: a.sourceId,
    title: a.title,
    description: a.description || null,
    owner_title: a.ownerTitle || null,
    priority: a.priority ?? null,
    start_date: a.startDate || null,
    due_date: a.dueDate || null,
    created_by: user.id,
  };

  const { error } = await supabase.from("actions").insert(row);
  if (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath("/department/actions");
  revalidatePath("/department");
  return { ok: true };
}

// ── Reads for the New action dialog ─────────────────────────────────────────
//
// Two reads live here beside the writes because the dialog calls them from
// the browser once a type or item is picked, as the share dialog does. Both
// read as the signed-in user: RLS decides what is listed, and nothing here
// filters by department.

const itemTypeSchema = z.enum(["risk", "kpi", "objective", "document"]);

const DOCUMENT_REQUEST_LABEL: Record<Enums<"document_request_type">, string> = {
  new: "New document",
  revision: "Revision",
  deletion: "Deletion",
};

function joinDetail(parts: (string | number | null | undefined)[]): string | null {
  const kept = parts.filter((p) => p !== null && p !== undefined && p !== "");
  return kept.length > 0 ? kept.join(" · ") : null;
}

const byLabel = (x: ActionTarget, y: ActionTarget) => x.label.localeCompare(y.label);

/** The items of one type a new action can be related to. Retired items are left out. */
export async function listActionTargets(type: ActionItemType): Promise<ActionTarget[]> {
  const parsed = itemTypeSchema.safeParse(type);
  if (!parsed.success) return [];
  const supabase = await createClient();

  switch (parsed.data) {
    case "risk": {
      const { data, error } = await supabase
        .from("risks")
        .select("id, risk_statement, threat, affected_assets, reference_number, departments ( code ), processes ( name )")
        .neq("status", "retired")
        .returns<
          {
            id: string;
            risk_statement: string | null;
            threat: string | null;
            affected_assets: string;
            reference_number: number | null;
            departments: { code: string } | null;
            processes: { name: string } | null;
          }[]
        >();
      if (error || !data) return [];
      return data
        .map((r) => ({
          id: r.id,
          // Same rule as the register's title column.
          label: r.risk_statement ?? r.threat ?? r.affected_assets,
          detail: joinDetail([
            r.departments?.code,
            r.processes?.name,
            r.reference_number !== null ? `Ref ${r.reference_number}` : null,
          ]),
        }))
        .sort(byLabel);
    }
    case "kpi": {
      const { data, error } = await supabase
        .from("kpis")
        .select("id, name, departments ( code ), processes ( name )")
        .is("retired_at", null)
        .returns<
          {
            id: string;
            name: string;
            departments: { code: string } | null;
            processes: { name: string } | null;
          }[]
        >();
      if (error || !data) return [];
      return data
        .map((k) => ({
          id: k.id,
          label: k.name,
          detail: joinDetail([k.departments?.code, k.processes?.name]),
        }))
        .sort(byLabel);
    }
    case "objective": {
      const { data, error } = await supabase
        .from("objectives")
        .select("id, title, departments ( code ), processes ( name )")
        .is("retired_at", null)
        .returns<
          {
            id: string;
            title: string;
            departments: { code: string } | null;
            processes: { name: string } | null;
          }[]
        >();
      if (error || !data) return [];
      return data
        .map((o) => ({
          id: o.id,
          label: o.title,
          detail: joinDetail([o.departments?.code, o.processes?.name]),
        }))
        .sort(byLabel);
    }
    case "document": {
      const { data, error } = await supabase
        .from("document_change_requests")
        .select("id, request_type, created_at, documents ( name, departments ( code ) )")
        .order("created_at", { ascending: false })
        .returns<
          {
            id: string;
            request_type: Enums<"document_request_type">;
            created_at: string;
            documents: { name: string; departments: { code: string } | null } | null;
          }[]
        >();
      if (error || !data) return [];
      return data.map((cr) => ({
        id: cr.id,
        label: cr.documents?.name ?? "Unnamed document",
        detail: joinDetail([
          cr.documents?.departments?.code,
          DOCUMENT_REQUEST_LABEL[cr.request_type],
          cr.created_at.slice(0, 10),
        ]),
      }));
    }
  }
}

type PeriodEmbed = {
  reporting_periods: { year: number; label: string; type: Enums<"period_type">; start_date: string } | null;
};

const periodsInput = z.object({
  type: z.enum(["risk", "kpi", "objective"]),
  itemId: z.uuid(),
});

/**
 * The quarters in which an item has a row a new action can link to: a
 * risk's treatment reviews, a KPI's or an objective's measurements. Latest
 * first. Queried from the item's own rows, so a quarter with no row simply
 * is not offered — the action then links to the item.
 */
export async function listActionTargetPeriods(
  type: ActionItemType,
  itemId: string
): Promise<ActionTargetPeriod[]> {
  const parsed = periodsInput.safeParse({ type, itemId });
  if (!parsed.success) return [];
  const supabase = await createClient();

  type Row = ActionTargetPeriod & { startDate: string };
  let rows: Row[] = [];

  const toRow = (
    sourceType: ActionTargetPeriod["sourceType"],
    sourceId: string,
    p: PeriodEmbed["reporting_periods"],
    note: string | null
  ): Row | null =>
    p && p.type === "quarterly"
      ? { sourceType, sourceId, year: p.year, label: p.label, note, startDate: p.start_date }
      : null;

  switch (parsed.data.type) {
    case "risk": {
      const { data, error } = await supabase
        .from("risk_treatments")
        .select(
          "treatment_solution, risk_treatment_reviews ( id, reporting_periods ( year, label, type, start_date ) )"
        )
        .eq("risk_id", parsed.data.itemId)
        .order("created_at", { ascending: true })
        .returns<{ treatment_solution: string; risk_treatment_reviews: ({ id: string } & PeriodEmbed)[] }[]>();
      if (error || !data) return [];
      rows = data.flatMap((t) =>
        t.risk_treatment_reviews
          .map((v) => toRow("risk_treatment_review", v.id, v.reporting_periods, t.treatment_solution))
          .filter((r): r is Row => r !== null)
      );
      break;
    }
    case "kpi": {
      const { data, error } = await supabase
        .from("kpi_measurements")
        .select("id, reporting_periods ( year, label, type, start_date )")
        .eq("kpi_id", parsed.data.itemId)
        .returns<({ id: string } & PeriodEmbed)[]>();
      if (error || !data) return [];
      rows = data
        .map((m) => toRow("kpi_measurement", m.id, m.reporting_periods, null))
        .filter((r): r is Row => r !== null);
      break;
    }
    case "objective": {
      const { data, error } = await supabase
        .from("objective_measurements")
        .select("id, reporting_periods ( year, label, type, start_date )")
        .eq("objective_id", parsed.data.itemId)
        .returns<({ id: string } & PeriodEmbed)[]>();
      if (error || !data) return [];
      rows = data
        .map((m) => toRow("objective_measurement", m.id, m.reporting_periods, null))
        .filter((r): r is Row => r !== null);
      break;
    }
  }

  // Stable sort: a risk's reviews in one quarter keep their treatment order.
  rows.sort((x, y) => y.startDate.localeCompare(x.startDate));

  // The treatment is only worth naming when a quarter has more than one review.
  const perQuarter = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.year}-${r.label}`;
    perQuarter.set(key, (perQuarter.get(key) ?? 0) + 1);
  }

  return rows.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    year: r.year,
    label: r.label,
    note: (perQuarter.get(`${r.year}-${r.label}`) ?? 0) > 1 ? r.note : null,
  }));
}

/**
 * Saves the update dialog: title, owner, priority, dates, status and
 * progress. Not the source or department — those are fixed at creation.
 * Who may do this is the actions_update policy's call, unchanged.
 */
export async function updateAction(input: UpdateActionInput): Promise<ActionMutationResult> {
  const parsed = updateActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid update" };
  }
  const a = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to update an action." };
  }

  const row: TablesUpdate<"actions"> = {
    title: a.title,
    owner_title: a.ownerTitle || null,
    priority: a.priority ?? null,
    start_date: a.startDate || null,
    due_date: a.dueDate || null,
    status: a.status,
    completion_percentage: a.completionPercentage ?? null,
    completed_date: a.completedDate || null,
  };

  // .select() so an update RLS filtered down to zero rows reads as a
  // refusal instead of a silent success.
  const { data, error } = await supabase.from("actions").update(row).eq("id", a.id).select("id");
  if (error) {
    return { ok: false, message: messageFor(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: friendlyMessage["42501"] };
  }

  revalidatePath("/department/actions");
  revalidatePath("/department");
  return { ok: true };
}

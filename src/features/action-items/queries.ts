import { createClient } from "@/lib/supabase/server";

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

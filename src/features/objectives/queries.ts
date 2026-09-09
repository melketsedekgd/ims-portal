import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DbObjectiveStatus = Database["public"]["Enums"]["objective_status"];

/**
 * The objective's own lifecycle, straight from objectives.status.
 *
 * Note this is NOT ObjectiveStatus from ObjectiveForm. That union is
 * "On Track" | "At Risk" | "Off Track" | "Achieved", and three of those four
 * have no column behind them anywhere in the schema — there is no health or
 * confidence field on objectives or objective_measurements. Emitting them would
 * mean inventing thresholds. See the note in the report.
 */
export type ObjectiveLifecycle = "Active" | "Achieved" | "Retired";

/**
 * Why the achievement figure reads the way it does for the selected period.
 * The four cases are genuinely different claims and the UI must not collapse
 * them into a blank cell or a zero:
 *
 *  measured           a snapshot exists — `achievement` is a real 0..1 figure
 *  not_measured       a snapshot exists and says N/A. Not zero, and excluded
 *                     from any average
 *  completed_earlier  no snapshot, because the objective was already achieved
 *                     in an earlier period and dropped off this report. Done,
 *                     not outstanding
 *  not_reported       no snapshot and still active — genuinely outstanding
 */
export type ObjectiveOutcome =
  | "measured"
  | "not_measured"
  | "completed_earlier"
  | "not_reported";

export type ObjectiveListItem = {
  id: string;
  period: string;
  processName: string;
  name: string;
  description: string;
  ownerTitle: string | null;
  /** objectives.target_date, raw ISO date. Formatting is the UI's decision. */
  targetDate: string | null;
  status: ObjectiveLifecycle;
  outcome: ObjectiveOutcome;
  /** 0..1, the stored snapshot. Non-null only when outcome is "measured". */
  achievement: number | null;
  activitiesCompleted: number | null;
  activitiesTotal: number | null;
};

type ObjectiveRow = {
  id: string;
  reference_number: number | null;
  title: string;
  description: string | null;
  owner_title: string | null;
  target_date: string | null;
  status: DbObjectiveStatus;
  processes: { name: string; display_order: number | null } | null;
  objective_measurements: {
    achievement: number | null;
    activities_completed: number | null;
    activities_total: number | null;
    not_measured: boolean;
  }[];
};

type Measurement = ObjectiveRow["objective_measurements"][number];

const LIFECYCLE: Record<DbObjectiveStatus, ObjectiveLifecycle> = {
  active: "Active",
  achieved: "Achieved",
  retired: "Retired",
};

function outcomeOf(
  status: DbObjectiveStatus,
  m: Measurement | undefined
): ObjectiveOutcome {
  if (m) return m.not_measured ? "not_measured" : "measured";
  // No snapshot for this period. An objective already marked achieved was
  // completed earlier and dropped off this quarter's report — it is done, not
  // pending. A retired one also reports nothing, but its lifecycle badge
  // carries that; "not_reported" is still literally accurate for it.
  return status === "achieved" ? "completed_earlier" : "not_reported";
}

// Nulls sort last. Infinity rather than a 9999 sentinel: reference_number is a
// smallint and can legitimately exceed any fixed sentinel.
const order = (n: number | null | undefined) => n ?? Number.POSITIVE_INFINITY;

export async function getObjectivesForPeriod(
  year: number,
  label: string
): Promise<ObjectiveListItem[]> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .single();

  if (!period) return [];

  const { data, error } = await supabase
    .from("objectives")
    .select(
      `id,
       reference_number,
       title,
       description,
       owner_title,
       target_date,
       status,
       processes ( name, display_order ),
       objective_measurements (
         achievement,
         activities_completed,
         activities_total,
         not_measured
       )`
    )
    .eq("objective_measurements.reporting_period_id", period.id)
    .returns<ObjectiveRow[]>();

  if (error) throw error;

  return (data ?? [])
    .sort(
      (a, b) =>
        order(a.processes?.display_order) - order(b.processes?.display_order) ||
        (a.processes?.name ?? "").localeCompare(b.processes?.name ?? "") ||
        order(a.reference_number) - order(b.reference_number) ||
        a.id.localeCompare(b.id)
    )
    .map((o) => {
      // objective_measurements_period_idx is UNIQUE on
      // (objective_id, reporting_period_id), so the period filter leaves at
      // most one row. Unlike risk_assessments, [0] is provably the only
      // candidate and no newest-wins reduce is needed.
      const m = o.objective_measurements[0];
      const outcome = outcomeOf(o.status, m);
      return {
        id: o.id,
        period: `${label} ${year}`,
        processName: o.processes?.name ?? "General",
        name: o.title,
        description: o.description ?? "",
        ownerTitle: o.owner_title,
        targetDate: o.target_date,
        status: LIFECYCLE[o.status],
        outcome,
        // The stored snapshot only. objective_achievement() counts live
        // activities and would re-score a closed quarter the moment someone
        // ticks off an activity afterwards.
        achievement: outcome === "measured" ? (m.achievement ?? null) : null,
        activitiesCompleted: outcome === "measured" ? m.activities_completed : null,
        activitiesTotal: outcome === "measured" ? m.activities_total : null,
      };
    });
}

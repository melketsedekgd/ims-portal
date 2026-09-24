import { createClient } from "@/lib/supabase/server";
import { getQuarterlyPeriods } from "@/features/periods/queries";
import type { Database } from "@/types/database";

type DbObjectiveStatus = Database["public"]["Enums"]["objective_status"];
type DbActivityStatus = Database["public"]["Enums"]["activity_status"];

export type ObjectiveActivity = {
  id: string;
  title: string;
  status: DbActivityStatus;
  completedDate: string | null;
};

/** The stored snapshot's editable fields, for pre-filling the dialog. */
export type ObjectiveMeasurementFields = {
  achievement: number | null;
  notMeasured: boolean;
  evidenceReference: string | null;
  reasonForDeviation: string | null;
  followupAction: string | null;
};

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
  /**
   * Live activities in display order, cancelled ones included so the dialog
   * can show them struck through rather than silently dropping them. Decides
   * the dialog's mode: any non-cancelled activity means achievement is
   * derived from these, none means it is entered directly.
   */
  activities: ObjectiveActivity[];
  /** This period's stored row, or null when there is none yet. */
  measurement: ObjectiveMeasurementFields | null;
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
  objective_activities: {
    id: string;
    title: string;
    status: DbActivityStatus;
    completed_date: string | null;
    display_order: number | null;
  }[];
  objective_measurements: {
    achievement: number | null;
    activities_completed: number | null;
    activities_total: number | null;
    not_measured: boolean;
    evidence_reference: string | null;
    reason_for_deviation: string | null;
    followup_action: string | null;
  }[];
};

/** The only field that decides an outcome, shared by both query shapes. */
type OutcomeFields = { not_measured: boolean };

const LIFECYCLE: Record<DbObjectiveStatus, ObjectiveLifecycle> = {
  active: "Active",
  achieved: "Achieved",
  retired: "Retired",
};

function outcomeOf(
  status: DbObjectiveStatus,
  m: OutcomeFields | undefined
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
  label: string,
  departmentId?: string
): Promise<ObjectiveListItem[]> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .single();

  if (!period) return [];

  let query = supabase
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
       objective_activities ( id, title, status, completed_date, display_order ),
       objective_measurements (
         achievement,
         activities_completed,
         activities_total,
         not_measured,
         evidence_reference,
         reason_for_deviation,
         followup_action
       )`
    )
    .eq("objective_measurements.reporting_period_id", period.id);

  // View filter, not a permission one — see kpis/queries.ts getKpisForPeriod.
  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query.returns<ObjectiveRow[]>();

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
        activities: [...o.objective_activities]
          .sort((a, b) => order(a.display_order) - order(b.display_order))
          .map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
            completedDate: a.completed_date,
          })),
        measurement: m
          ? {
              achievement: m.achievement,
              notMeasured: m.not_measured,
              evidenceReference: m.evidence_reference,
              reasonForDeviation: m.reason_for_deviation,
              followupAction: m.followup_action,
            }
          : null,
      };
    });
}

export type QuarterObjectiveCounts = {
  label: string;
  measured: number;
  notMeasured: number;
  completedEarlier: number;
  notReported: number;
  total: number;
};

type ObjectiveSeriesRow = {
  id: string;
  status: DbObjectiveStatus;
  objective_measurements: (OutcomeFields & { reporting_period_id: string })[];
};

/**
 * Objective outcome counts for every quarter of a year, in one round trip.
 *
 * `total` is the same every quarter, because an objective is long-lived and
 * exists whether or not it was reported on. That flat line is the honest
 * shape: what moves between quarters is how many were measured, not how many
 * existed.
 */
export async function getObjectiveCountsByQuarter(
  year: number,
  departmentId?: string
): Promise<QuarterObjectiveCounts[]> {
  const periods = await getQuarterlyPeriods(year);
  if (periods.length === 0) return [];

  const supabase = await createClient();

  let query = supabase
    .from("objectives")
    .select(
      `id,
       status,
       objective_measurements (
         reporting_period_id,
         not_measured
       )`
    )
    .in(
      "objective_measurements.reporting_period_id",
      periods.map((p) => p.id)
    );

  // View filter, not a permission one — see kpis/queries.ts getKpisForPeriod.
  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query.returns<ObjectiveSeriesRow[]>();

  if (error) throw error;

  const objectives = data ?? [];

  return periods.map((period) => {
    const counts: QuarterObjectiveCounts = {
      label: period.label,
      measured: 0,
      notMeasured: 0,
      completedEarlier: 0,
      notReported: 0,
      total: objectives.length,
    };

    for (const o of objectives) {
      const m = o.objective_measurements.find(
        (row) => row.reporting_period_id === period.id
      );
      switch (outcomeOf(o.status, m)) {
        case "measured":
          counts.measured++;
          break;
        case "not_measured":
          counts.notMeasured++;
          break;
        case "completed_earlier":
          counts.completedEarlier++;
          break;
        case "not_reported":
          counts.notReported++;
          break;
      }
    }

    return counts;
  });
}

// ── Objective detail ─────────────────────────────────────────────────────────

type ObjectiveDetailRow = {
  id: string;
  department_id: string;
  reference_number: number | null;
  title: string;
  description: string | null;
  owner_title: string | null;
  start_date: string | null;
  target_date: string | null;
  status: DbObjectiveStatus;
  created_at: string;
  processes: { name: string } | null;
  departments: { code: string; name: string } | null;
  objective_activities: {
    id: string;
    title: string;
    status: DbActivityStatus;
    completed_date: string | null;
    display_order: number | null;
  }[];
  objective_measurements: {
    id: string;
    achievement: number | null;
    activities_completed: number | null;
    activities_total: number | null;
    not_measured: boolean;
    evidence_reference: string | null;
    reason_for_deviation: string | null;
    followup_action: string | null;
    recorded_at: string;
    reporting_periods: { year: number; label: string; start_date: string } | null;
  }[];
};

export type ObjectiveHistoryRow = ObjectiveMeasurementFields & {
  id: string;
  /** "Q1 2026" */
  period: string;
  startDate: string;
  /**
   * The counts the achievement was computed from, snapshotted at entry time.
   * Both null for an objective with no activities — its achievement was
   * entered directly and there is no "of N" to show.
   */
  activitiesCompleted: number | null;
  activitiesTotal: number | null;
  recordedAt: string;
};

export type ObjectiveDetail = {
  id: string;
  /** Restarts per department every quarter — a label, never an identifier. */
  referenceNumber: number | null;
  title: string;
  description: string | null;
  ownerTitle: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: ObjectiveLifecycle;
  createdAt: string;
  /** null when the objective sits under no process — a decision, not a gap. */
  processName: string | null;
  department: { code: string; name: string } | null;
  departmentId: string;
  /**
   * Live activities in display order, cancelled ones included. Empty for
   * every SRD objective: their achievement is entered directly, and the
   * page must not show an activity section or compute "0 of 0" for them.
   */
  activities: ObjectiveActivity[];
  /** One per period with a stored snapshot, oldest first. */
  history: ObjectiveHistoryRow[];
};

/**
 * One objective with its activities and every measurement recorded against it.
 *
 * No department filter: RLS scopes the read. null means "no such id" OR
 * "exists in a department this user cannot read" — the two are
 * indistinguishable by design, and the page must treat both as not found.
 *
 * History reads the stored snapshot only. activities_completed /
 * activities_total are what the report said at the time; the live activity
 * list can disagree with an older row (Q1 stored 3 of 3 while only one is
 * completed today) and that disagreement is the point — a closed quarter is
 * not re-scored when someone edits an activity later.
 */
export async function getObjectiveWithHistory(
  id: string
): Promise<ObjectiveDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("objectives")
    .select(
      `id,
       department_id,
       reference_number,
       title,
       description,
       owner_title,
       start_date,
       target_date,
       status,
       created_at,
       processes ( name ),
       departments ( code, name ),
       objective_activities ( id, title, status, completed_date, display_order ),
       objective_measurements (
         id,
         achievement,
         activities_completed,
         activities_total,
         not_measured,
         evidence_reference,
         reason_for_deviation,
         followup_action,
         recorded_at,
         reporting_periods ( year, label, start_date )
       )`
    )
    .eq("id", id)
    .maybeSingle()
    .returns<ObjectiveDetailRow | null>();

  // 22P02: the URL segment is not a uuid. Not found, same as an unknown id.
  if (error?.code === "22P02") return null;
  if (error) throw error;
  if (!data) return null;

  const history: ObjectiveHistoryRow[] = data.objective_measurements
    .filter((m) => m.reporting_periods !== null)
    .map((m) => {
      const p = m.reporting_periods!;
      return {
        id: m.id,
        period: `${p.label} ${p.year}`,
        startDate: p.start_date,
        achievement: m.achievement,
        notMeasured: m.not_measured,
        activitiesCompleted: m.activities_completed,
        activitiesTotal: m.activities_total,
        evidenceReference: m.evidence_reference,
        reasonForDeviation: m.reason_for_deviation,
        followupAction: m.followup_action,
        recordedAt: m.recorded_at,
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    id: data.id,
    referenceNumber: data.reference_number,
    title: data.title,
    description: data.description,
    ownerTitle: data.owner_title,
    startDate: data.start_date,
    targetDate: data.target_date,
    status: LIFECYCLE[data.status],
    createdAt: data.created_at,
    processName: data.processes?.name ?? null,
    department: data.departments,
    departmentId: data.department_id,
    activities: [...data.objective_activities]
      .sort((a, b) => order(a.display_order) - order(b.display_order))
      .map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        completedDate: a.completed_date,
      })),
    history,
  };
}

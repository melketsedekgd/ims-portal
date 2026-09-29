/**
 * Objective progress against where each objective should be by now.
 *
 * Pure — no React, no queries — like heatmap.ts, so the rules below can be
 * exercised from a plain script. The dashboard's objectives card only draws
 * what this returns.
 */
import type { ObjectiveListItem } from "@/features/objectives/queries";

export type ObjectiveProgressStatus =
  | "behind"
  | "not_entered"
  | "not_measured"
  | "on_track"
  | "complete"
  | "achieved";

export type ObjectiveProgressRow = {
  id: string;
  title: string;
  status: ObjectiveProgressStatus;
  /** 0–100, rounded; null when nothing was entered or it was entered as N/A. */
  actual: number | null;
  /** 0–100, rounded; null when neither activities nor dates say. */
  expected: number | null;
};

export type ObjectiveProgress = {
  /** Every objective in the population, in display order. */
  rows: ObjectiveProgressRow[];
  behind: number;
  onTrack: number;
  /** Achieved and complete together: both are at 100%. */
  achieved: number;
};

/**
 * A time-based expectation is an estimate — nobody plans an objective to
 * move in a straight line from start to target — so it gets this much
 * slack before an objective is called behind. An activity plan is a
 * commitment and gets none.
 */
const TIME_TOLERANCE = 5;

const clampPercent = (n: number) => Math.min(Math.max(n, 0), 100);

const DAY_MS = 86_400_000;

/**
 * Where the objective should be at the period's end, and on what basis.
 *
 * Activities win when every non-cancelled one has a planned completion
 * date: the share planned to be done by the period end. Otherwise the share
 * of start_date → target_date elapsed at the period end. A missing date on
 * either side leaves no basis at all, and null — not 0 — says so.
 */
function expectedAt(
  o: ObjectiveListItem,
  periodEnd: string
): { value: number; basis: "activities" | "time" } | null {
  const live = o.activities.filter((a) => a.status !== "cancelled");
  if (live.length > 0 && live.every((a) => a.plannedCompletionDate !== null)) {
    // ISO dates compare correctly as strings, as overlaps() relies on.
    const due = live.filter((a) => (a.plannedCompletionDate as string) <= periodEnd).length;
    return { value: (due / live.length) * 100, basis: "activities" };
  }

  if (!o.startDate || !o.targetDate) return null;
  const span = (Date.parse(o.targetDate) - Date.parse(o.startDate)) / DAY_MS;
  if (span <= 0) return null;
  const elapsed = (Date.parse(periodEnd) - Date.parse(o.startDate)) / DAY_MS;
  return { value: clampPercent((elapsed / span) * 100), basis: "time" };
}

/**
 * The strip's population, from quarter_reporting_overview()'s rule: every
 * objective (already date-overlapping, from the list query) with a value
 * this period, plus the active, unretired ones still without one.
 */
function isDue(o: ObjectiveListItem): boolean {
  const m = o.measurement;
  const hasValue = !!m && (m.notMeasured || m.achievement !== null);
  return hasValue || (o.status === "Active" && o.retiredAt === null);
}

function progressOf(o: ObjectiveListItem, periodEnd: string): ObjectiveProgressRow & { gap: number } {
  const m = o.measurement;
  const expected = expectedAt(o, periodEnd);
  const expectedPct = expected ? Math.round(expected.value) : null;

  // This period's measurement. An objective closed as achieved with no
  // measurement this period finished earlier: it is at 100%, not missing.
  const fraction =
    m && !m.notMeasured && m.achievement !== null
      ? m.achievement
      : !m && o.status === "Achieved"
        ? 1
        : null;
  const actual = fraction === null ? null : Math.round(fraction * 100);

  const row = { id: o.id, title: o.name, actual, expected: expectedPct, gap: 0 };

  if (o.status === "Achieved") return { ...row, status: "achieved" };
  if (m?.notMeasured) return { ...row, status: "not_measured" };
  if (actual === null) return { ...row, status: "not_entered" };
  if (actual >= 100) return { ...row, status: "complete" };

  // Rounded on both sides, so the verdict agrees with the bar and the tick
  // the reader sees rather than with a fourth decimal they cannot.
  if (expected && expectedPct !== null) {
    const slack = expected.basis === "time" ? TIME_TOLERANCE : 0;
    if (actual < expectedPct - slack) {
      return { ...row, status: "behind", gap: expectedPct - actual };
    }
  }
  return { ...row, status: "on_track" };
}

/** Behind first, worst gap first; then nothing to go on; then fine; then done. */
const RANK: Record<ObjectiveProgressStatus, number> = {
  behind: 0,
  not_entered: 1,
  not_measured: 1,
  on_track: 2,
  complete: 3,
  achieved: 3,
};

export function objectiveProgress(
  objectives: readonly ObjectiveListItem[],
  periodEnd: string
): ObjectiveProgress {
  // Array.prototype.sort is stable, so ties keep the list query's order:
  // process, then reference number.
  const rows = objectives
    .filter(isDue)
    .map((o) => progressOf(o, periodEnd))
    .sort((a, b) => RANK[a.status] - RANK[b.status] || b.gap - a.gap);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      actual: r.actual,
      expected: r.expected,
    })),
    behind: rows.filter((r) => r.status === "behind").length,
    onTrack: rows.filter((r) => r.status === "on_track").length,
    achieved: rows.filter((r) => r.status === "achieved" || r.status === "complete").length,
  };
}

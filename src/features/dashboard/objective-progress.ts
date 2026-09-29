/**
 * Objective progress against where each objective should be by now.
 *
 * Pure — no React, no queries — like heatmap.ts, so the rules below can be
 * exercised from a plain script. The dashboard's objectives card only draws
 * what this returns.
 */
import type { ObjectiveListItem } from "@/features/objectives/queries";
import { scoreBand, type ScoreBand } from "@/features/dashboard/heatmap";

export type ObjectiveProgressRow = {
  id: string;
  title: string;
  /** 0–100, rounded; null when nothing was entered or it was entered as N/A. */
  actual: number | null;
  /** 0–100, rounded; null when neither activities nor dates say. */
  expected: number | null;
  /** Entered as N/A this period, as opposed to not entered at all. */
  notMeasured: boolean;
  /** scoreBand(pace): judged against where it should be, not raw %. */
  band: ScoreBand;
};

export type ObjectiveProgress = {
  /** Every objective in the population, in display order. */
  rows: ObjectiveProgressRow[];
  /** Rows in each pace band: below 60%, 60–79%, 80% and up. */
  behind: number;
  slightlyBehind: number;
  onTrack: number;
};

const clampPercent = (n: number) => Math.min(Math.max(n, 0), 100);

const DAY_MS = 86_400_000;

/**
 * Where the objective should be at the period's end, 0–100.
 *
 * Activities win when every non-cancelled one has a planned completion
 * date: the share planned to be done by the period end. Otherwise the share
 * of start_date → target_date elapsed at the period end. A missing date on
 * either side leaves no basis at all, and null — not 0 — says so.
 */
function expectedAt(o: ObjectiveListItem, periodEnd: string): number | null {
  const live = o.activities.filter((a) => a.status !== "cancelled");
  if (live.length > 0 && live.every((a) => a.plannedCompletionDate !== null)) {
    // ISO dates compare correctly as strings, as overlaps() relies on.
    const due = live.filter((a) => (a.plannedCompletionDate as string) <= periodEnd).length;
    return (due / live.length) * 100;
  }

  if (!o.startDate || !o.targetDate) return null;
  const span = (Date.parse(o.targetDate) - Date.parse(o.startDate)) / DAY_MS;
  if (span <= 0) return null;
  const elapsed = (Date.parse(periodEnd) - Date.parse(o.startDate)) / DAY_MS;
  return clampPercent((elapsed / span) * 100);
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

/**
 * Achievement as a share of where the objective should be by now, 0..1.
 *
 * Nothing due yet (expected 0) is pace 1: an objective early in its year is
 * on schedule, not failing. No basis for an expectation at all is also
 * pace 1 — there is no schedule to be behind.
 */
function paceOf(actual: number, expected: number | null): number {
  if (expected === null || expected <= 0) return 1;
  return Math.min(Math.max(actual / expected, 0), 1);
}

function progressOf(o: ObjectiveListItem, periodEnd: string): ObjectiveProgressRow & { pace: number } {
  const m = o.measurement;
  const expectedRaw = expectedAt(o, periodEnd);
  const expected = expectedRaw === null ? null : Math.round(expectedRaw);

  // This period's measurement. An objective closed as achieved with no
  // measurement this period finished earlier: it is at 100%, not missing.
  const fraction =
    m && !m.notMeasured && m.achievement !== null
      ? m.achievement
      : !m && o.status === "Achieved"
        ? 1
        : null;
  const actual = fraction === null ? null : Math.round(fraction * 100);

  // Rounded on both sides, so the verdict agrees with the bar and the
  // marker the reader sees rather than with a fourth decimal they cannot.
  const pace = actual === null ? null : paceOf(actual, expected);

  return {
    id: o.id,
    title: o.name,
    actual,
    expected,
    notMeasured: !!m?.notMeasured,
    band: scoreBand(pace),
    pace: pace ?? 0,
  };
}

/** Behind first, then slightly behind, then nothing to go on, then fine. */
const RANK: Record<ScoreBand, number> = { bad: 0, warn: 1, none: 2, good: 3 };

export function objectiveProgress(
  objectives: readonly ObjectiveListItem[],
  periodEnd: string
): ObjectiveProgress {
  // Array.prototype.sort is stable, so ties keep the list query's order:
  // process, then reference number.
  const rows = objectives
    .filter(isDue)
    .map((o) => progressOf(o, periodEnd))
    .sort((a, b) => RANK[a.band] - RANK[b.band] || a.pace - b.pace);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      actual: r.actual,
      expected: r.expected,
      notMeasured: r.notMeasured,
      band: r.band,
    })),
    behind: rows.filter((r) => r.band === "bad").length,
    slightlyBehind: rows.filter((r) => r.band === "warn").length,
    onTrack: rows.filter((r) => r.band === "good").length,
  };
}

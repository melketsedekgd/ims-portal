import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ReportingPeriod = {
  year: number;
  /** The quarter label as stored: "Q1" … "Q4". */
  label: string;
};

/**
 * Today as YYYY-MM-DD in UTC.
 *
 * PostgREST filters compare a column to a literal — there is no way to write
 * `start_date <= current_date` through the REST API — so the date has to be
 * computed here and sent as a value. UTC rather than the Node process's local
 * timezone because Postgres `current_date` resolves in the database session's
 * timezone, which is UTC on Supabase by default; this keeps the two in
 * agreement. On the single boundary day between two quarters a server running
 * in a non-UTC zone could otherwise disagree with the database by a day.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The reporting period the application should default to.
 *
 * Resolved by date range, not by `status`. Both Q3 and Q4 2026 are 'open', so
 * status alone cannot identify "now" — it marks which periods still accept
 * entry, which is a different question.
 *
 * Three tiers, in order:
 *
 *   1. the quarterly period whose start_date..end_date contains today
 *   2. the most recent closed quarterly period, if the calendar has a gap
 *   3. today's calendar quarter, if reporting_periods is empty or unreadable
 *
 * Tier 3 is the only one that can name a period which does not exist as a row.
 * When that happens every period-scoped query returns [] and the page renders
 * empty — but the picker is still labelled correctly and the user can navigate
 * out of it, which beats throwing.
 *
 * Wrapped in cache() so several server components in one render share a single
 * round trip, the same way getCurrentUser() does.
 */
export const getCurrentPeriod = cache(async (): Promise<ReportingPeriod> => {
  const supabase = await createClient();
  const today = todayUtc();

  // 1. The quarter containing today.
  //
  // limit(1) rather than maybeSingle(): nothing in the schema forbids
  // overlapping date ranges (the unique index covers year/type/label only), and
  // maybeSingle() throws when more than one row comes back. A misconfigured
  // calendar should not take down the landing page of every dashboard, so on an
  // overlap the most recently started quarter wins.
  const { data: current } = await supabase
    .from("reporting_periods")
    .select("year, label")
    .eq("type", "quarterly")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("start_date", { ascending: false })
    .limit(1);

  if (current?.[0]) return current[0];

  // 2. A gap in the calendar — fall back to the last quarter that closed.
  const { data: lastClosed } = await supabase
    .from("reporting_periods")
    .select("year, label")
    .eq("type", "quarterly")
    .eq("status", "closed")
    .order("end_date", { ascending: false })
    .limit(1);

  if (lastClosed?.[0]) return lastClosed[0];

  // 3. Nothing in the table at all. Derive the calendar quarter so the UI has a
  //    coherent label to show. Assumes quarters align to the calendar year,
  //    which the database is otherwise the authority on.
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    label: `Q${Math.floor(now.getUTCMonth() / 3) + 1}`,
  };
});

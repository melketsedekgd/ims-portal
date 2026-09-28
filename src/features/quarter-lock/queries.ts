import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";
import { UNLOCKED, type QuarterLock } from "./types";

const LOCKING: ReadonlySet<Enums<"signoff_status">> = new Set(["submitted", "approved", "received"]);

/**
 * Lock state for every period on a page, keyed by reporting period id, for
 * one department. Two queries whatever the number of periods: the sign-offs
 * and the period statuses.
 *
 * The department_id filter is not RLS scoping. A sign-off is identified by
 * (department, period), and an IMS reader sees every department's — this
 * picks the one row the lock is about, as guard_quarter_lock() does.
 *
 * A period missing from the result was not readable; it comes back unlocked
 * and the database still refuses the write if it has to.
 */
export async function getQuarterLocks(
  departmentId: string,
  periodIds: string[],
  { isAdmin }: { isAdmin: boolean }
): Promise<Record<string, QuarterLock>> {
  const ids = [...new Set(periodIds)];
  const locks: Record<string, QuarterLock> = {};
  if (ids.length === 0) return locks;

  const supabase = await createClient();
  const [signoffs, periods] = await Promise.all([
    supabase
      .from("quarter_signoffs")
      .select("reporting_period_id, status")
      .eq("department_id", departmentId)
      .in("reporting_period_id", ids),
    supabase.from("reporting_periods").select("id, status").in("id", ids),
  ]);
  if (signoffs.error) throw signoffs.error;
  if (periods.error) throw periods.error;

  for (const id of ids) locks[id] = UNLOCKED;

  // Closed first, so a sign-off overwrites it: the sign-off binds admins
  // too and is the more specific reason.
  for (const p of periods.data ?? []) {
    if (p.status === "closed" && !isAdmin) locks[p.id] = { locked: true, reason: "closed" };
  }
  for (const s of signoffs.data ?? []) {
    if (LOCKING.has(s.status)) {
      locks[s.reporting_period_id] = { locked: true, reason: "signed_off", status: s.status };
    }
  }

  return locks;
}

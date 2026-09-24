import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/lib/permissions";
import type { Enums } from "@/types/database";

export type SignoffStatus = Enums<"signoff_status">;

/** Today as YYYY-MM-DD in UTC, matching features/periods/queries.ts. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export type MissingItem = { kind: string; itemId: string; name: string };

export async function getMissingItems(
  departmentId: string,
  periodId: string
): Promise<MissingItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("quarter_missing_items", {
    p_department_id: departmentId,
    p_period_id: periodId,
  });

  // The generated Returns for a set-returning function does not survive
  // inference through .rpc(), and .returns<T[]>() is rejected here as a
  // single-to-array cast. Naming the row shape is the narrowest fix.
  const rows = (data ?? []) as { kind: string; item_id: string; name: string }[];
  return rows.map((r) => ({ kind: r.kind, itemId: r.item_id, name: r.name }));
}

/* ---------------------------------------------------------------------
 * The review page
 * ------------------------------------------------------------------- */

export type SignoffDetail = {
  id: string;
  periodYear: number;
  periodLabel: string;
  /** Whose quarter it is — the dashboard IMS has to be pointed at. */
  departmentCode: string;
};

/**
 * Just enough to send a notification link to the right quarter.
 *
 * Null means "not visible to you", which RLS makes indistinguishable from
 * "no such row" — and the redirect treats both the same way.
 *
 * The department comes back too, because an IMS admin's dashboard shows one
 * department at a time now. Without it every sign-off notification landed
 * them on IMS's own empty dashboard instead of on the quarter they had just
 * been told about.
 */
export async function getSignoffDetail(id: string): Promise<SignoffDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("quarter_signoffs")
    .select(`id, reporting_periods ( year, label ), departments ( code )`)
    .eq("id", id)
    .maybeSingle()
    .returns<{
      id: string;
      reporting_periods: { year: number; label: string } | null;
      departments: { code: string } | null;
    } | null>();

  if (!data?.reporting_periods || !data.departments) return null;

  return {
    id: data.id,
    periodYear: data.reporting_periods.year,
    periodLabel: data.reporting_periods.label,
    departmentCode: data.departments.code,
  };
}

/* ---------------------------------------------------------------------
 * The dashboard header
 * ------------------------------------------------------------------- */

export type HeaderSignoff = {
  departmentId: string;
  periodId: string;
  year: number;
  quarter: string;
  status: SignoffStatus;
  signoffId: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  receivedAt: string | null;
  samePerson: boolean;
  returnReason: string | null;
  returnedBy: string | null;
  missing: MissingItem[];
  canSubmit: boolean;
  canDecide: boolean;
  canReceive: boolean;
  /** An earlier quarter that has ended and still isn't signed off. */
  unsignedEarlier: { year: number; label: string } | null;
};

/**
 * The single department this user's dashboard is about, or null.
 *
 * The fallback, used when the caller names no department. For anyone
 * holding exactly one department role it is that department; for anyone
 * holding none (viewers) or two it is null, and the header stays empty
 * because sign-off is per department and neither case names one.
 *
 * IMS admins hold no department role, so this returns null for them — which
 * is why IMS never saw Return or Mark received before the dashboard learned
 * to name a department explicitly. They pass departmentId instead.
 */
function soleDepartmentId(user: Awaited<ReturnType<typeof getCurrentUser>>): string | null {
  const ids = new Set(
    (user?.roles ?? []).map((r) => r.departmentId).filter((id): id is string => !!id)
  );
  return ids.size === 1 ? [...ids][0] : null;
}

export async function getHeaderSignoff(
  year: number,
  quarter: string,
  forDepartmentId?: string
): Promise<HeaderSignoff | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const departmentId = forDepartmentId ?? soleDepartmentId(user);
  if (!departmentId) return null;

  // A department that takes no part in sign-off has no sign-off state to
  // show: no badge, no subtitle, no buttons. record_quarter_decision
  // refuses it outright, so a header offering the buttons would be offering
  // a decision the database will not record.
  const { data: department } = await supabase
    .from("departments")
    .select("takes_part_in_signoff")
    .eq("id", departmentId)
    .maybeSingle();

  if (!department?.takes_part_in_signoff) return null;

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id, year, label, status, end_date")
    .eq("year", year)
    .eq("label", quarter)
    .eq("type", "quarterly")
    .maybeSingle();

  // Q1 and Q2 were signed on paper. A closed quarter gets no sign-off UI.
  if (!period || period.status === "closed") return null;

  const { data: row } = await supabase
    .from("quarter_signoffs")
    .select(
      `id, status, submitted_by, submitted_at, approved_by, received_at,
       submitter:profiles!quarter_signoffs_submitted_by_fkey ( full_name ),
       approver:profiles!quarter_signoffs_approved_by_fkey ( full_name )`
    )
    .eq("department_id", departmentId)
    .eq("reporting_period_id", period.id)
    .maybeSingle()
    .returns<{
      id: string;
      status: SignoffStatus;
      submitted_by: string | null;
      submitted_at: string | null;
      approved_by: string | null;
      received_at: string | null;
      submitter: { full_name: string } | null;
      approver: { full_name: string } | null;
    } | null>();

  const status: SignoffStatus = row?.status ?? "open";

  // Only a returned quarter needs its reason, and only the most recent one.
  let returnReason: string | null = null;
  let returnedBy: string | null = null;
  if (status === "returned" && row) {
    const { data: last } = await supabase
      .from("quarter_signoff_decisions")
      .select(`reason, profiles ( full_name )`)
      .eq("signoff_id", row.id)
      .eq("decision", "return")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<{ reason: string | null; profiles: { full_name: string } | null } | null>();
    returnReason = last?.reason ?? null;
    returnedBy = last?.profiles?.full_name ?? null;
  }

  const roles = user?.roles ?? [];
  const inDepartment = (key: string) =>
    roles.some((r) => r.departmentId === departmentId && r.key === key);

  const canAct = inDepartment("department_contributor") || inDepartment("department_manager");
  const needsFigures = status === "open" || status === "returned";

  const missing =
    canAct && needsFigures ? await getMissingItems(departmentId, period.id) : [];

  // An earlier quarter that has already ended and is still unsigned. Shown as
  // a nudge on the later quarter rather than by moving the user, because the
  // period in the URL is the user's choice.
  const { data: earlier } = await supabase
    .from("reporting_periods")
    .select("id, year, label, end_date")
    .eq("type", "quarterly")
    .eq("status", "open")
    .lt("end_date", todayUtc())
    .lt("start_date", period.end_date)
    .order("start_date", { ascending: true });

  let unsignedEarlier: { year: number; label: string } | null = null;
  for (const e of earlier ?? []) {
    if (e.id === period.id) continue;
    const { data: s } = await supabase
      .from("quarter_signoffs")
      .select("status")
      .eq("department_id", departmentId)
      .eq("reporting_period_id", e.id)
      .maybeSingle();
    if (s?.status !== "received") {
      unsignedEarlier = { year: e.year, label: e.label };
      break;
    }
  }

  return {
    departmentId,
    periodId: period.id,
    year: period.year,
    quarter: period.label,
    status,
    signoffId: row?.id ?? null,
    submittedBy: row?.submitter?.full_name ?? null,
    submittedAt: row?.submitted_at ?? null,
    approvedBy: row?.approver?.full_name ?? null,
    receivedAt: row?.received_at ?? null,
    samePerson:
      !!row?.submitted_by && row.submitted_by === row.approved_by,
    returnReason,
    returnedBy,
    missing,
    canSubmit: canAct && needsFigures,
    canDecide: inDepartment("department_manager"),
    canReceive: isAdmin(user),
    unsignedEarlier,
  };
}

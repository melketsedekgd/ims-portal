import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { getCurrentPeriod, type ReportingPeriod } from "@/features/periods/queries";
import { isAdmin } from "@/lib/permissions";
import type { Enums } from "@/types/database";

export type SignoffStatus = Enums<"signoff_status">;

/** Today as YYYY-MM-DD in UTC, matching features/periods/queries.ts. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The period /sign-off opens on, which is deliberately not getCurrentPeriod().
 *
 * getCurrentPeriod() answers "which quarter are we in", and on 1 October that
 * becomes Q4. Sign-off is the opposite question: which quarter still needs
 * signing. Q3's figures are entered and signed during October, so the page has
 * to stay on Q3 until every department the user can see has been received.
 *
 * The earliest open quarter that has already started and is not fully received
 * wins. Falling back to getCurrentPeriod() keeps the picker labelled and
 * navigable when there is nothing outstanding.
 */
export async function getDefaultSignoffPeriod(): Promise<ReportingPeriod> {
  const supabase = await createClient();

  const { data: periods } = await supabase
    .from("reporting_periods")
    .select("id, year, label, start_date")
    .eq("type", "quarterly")
    .eq("status", "open")
    .lte("start_date", todayUtc())
    .order("start_date", { ascending: true });

  if (!periods || periods.length === 0) return getCurrentPeriod();

  const visible = await getVisibleDepartments();
  if (visible.length === 0) return getCurrentPeriod();

  // RLS already limits these rows to departments the user may see.
  const { data: signoffs } = await supabase
    .from("quarter_signoffs")
    .select("department_id, reporting_period_id, status")
    .in("reporting_period_id", periods.map((p) => p.id));

  for (const period of periods) {
    const received = (signoffs ?? []).filter(
      (s) =>
        s.reporting_period_id === period.id &&
        s.status === "received" &&
        visible.some((d) => d.id === s.department_id)
    ).length;

    if (received < visible.length) return { year: period.year, label: period.label };
  }

  return getCurrentPeriod();
}

export type VisibleDepartment = { id: string; name: string; code: string };

/**
 * The departments whose sign-off the user should see listed.
 *
 * departments_select is `using (true)` — everyone can read the department
 * list, because names appear all over the UI — so this narrowing happens
 * here. It decides what is listed, not what may be read: quarter_signoffs
 * has its own policy, and record_quarter_decision() its own checks.
 */
export async function getVisibleDepartments(): Promise<VisibleDepartment[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("departments")
    .select("id, name, code")
    .eq("status", "active")
    .order("code");

  const all = data ?? [];
  const imsWide = user.roles.some(
    (r) => r.key === "ims_admin" || r.key === "ims_reviewer"
  );
  if (imsWide) return all;

  const mine = new Set(user.roles.map((r) => r.departmentId).filter(Boolean));
  return all.filter((d) => mine.has(d.id));
}

export type SignoffRow = {
  signoffId: string | null;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  status: SignoffStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  receivedBy: string | null;
  receivedAt: string | null;
  /** Whether the viewer may submit this department's quarter (UI hint only). */
  canSubmit: boolean;
};

export type SignoffIndex = {
  period: { id: string; year: number; label: string; status: Enums<"period_status"> } | null;
  rows: SignoffRow[];
};

type SignoffDbRow = {
  id: string;
  department_id: string;
  status: SignoffStatus;
  submitted_at: string | null;
  approved_at: string | null;
  received_at: string | null;
  submitter: { full_name: string } | null;
  approver: { full_name: string } | null;
  receiver: { full_name: string } | null;
};

export async function getSignoffIndex(
  year: number,
  label: string
): Promise<SignoffIndex> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id, year, label, status")
    .eq("year", year)
    .eq("label", label)
    .eq("type", "quarterly")
    .maybeSingle();

  if (!period) return { period: null, rows: [] };

  const departments = await getVisibleDepartments();

  // The three profile joins are many-to-one, which the generated types call
  // arrays; .returns<T[]>() states the real shape.
  const { data: signoffs } = await supabase
    .from("quarter_signoffs")
    .select(
      `id, department_id, status, submitted_at, approved_at, received_at,
       submitter:profiles!quarter_signoffs_submitted_by_fkey ( full_name ),
       approver:profiles!quarter_signoffs_approved_by_fkey ( full_name ),
       receiver:profiles!quarter_signoffs_received_by_fkey ( full_name )`
    )
    .eq("reporting_period_id", period.id)
    .returns<SignoffDbRow[]>();

  const byDepartment = new Map((signoffs ?? []).map((s) => [s.department_id, s]));

  // Mirrors the submit branch of record_quarter_decision(). A hint for what
  // to render; the RPC remains the authority on what is allowed.
  const submittable = new Set(
    (user?.roles ?? [])
      .filter(
        (r) =>
          r.departmentId &&
          (r.key === "department_contributor" || r.key === "department_manager")
      )
      .map((r) => r.departmentId as string)
  );

  const rows: SignoffRow[] = departments.map((d) => {
    const s = byDepartment.get(d.id);
    const status: SignoffStatus = s?.status ?? "open";
    return {
      signoffId: s?.id ?? null,
      departmentId: d.id,
      departmentName: d.name,
      departmentCode: d.code,
      status,
      submittedBy: s?.submitter?.full_name ?? null,
      submittedAt: s?.submitted_at ?? null,
      approvedBy: s?.approver?.full_name ?? null,
      approvedAt: s?.approved_at ?? null,
      receivedBy: s?.receiver?.full_name ?? null,
      receivedAt: s?.received_at ?? null,
      canSubmit:
        submittable.has(d.id) && (status === "open" || status === "returned"),
    };
  });

  // An IMS admin's job on this page is the receipts, so those come first.
  if (isAdmin(user)) {
    rows.sort((a, b) => {
      const rank = (r: SignoffRow) => (r.status === "approved" ? 0 : 1);
      return rank(a) - rank(b) || a.departmentCode.localeCompare(b.departmentCode);
    });
  }

  return { period, rows };
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
  departmentId: string;
  departmentName: string;
  periodId: string;
  periodYear: number;
  periodLabel: string;
  status: SignoffStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  submittedById: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  receivedBy: string | null;
  receivedAt: string | null;
};

type DetailDbRow = {
  id: string;
  department_id: string;
  reporting_period_id: string;
  status: SignoffStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  received_at: string | null;
  departments: { name: string } | null;
  reporting_periods: { year: number; label: string } | null;
  submitter: { full_name: string } | null;
  approver: { full_name: string } | null;
  receiver: { full_name: string } | null;
};

/**
 * Null means "not visible to you", which is a permissions answer rather than
 * a missing row — RLS hides another department's sign-off exactly as it hides
 * one that does not exist. The page says so instead of throwing.
 */
export async function getSignoffDetail(id: string): Promise<SignoffDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("quarter_signoffs")
    .select(
      `id, department_id, reporting_period_id, status,
       submitted_by, submitted_at, approved_by, approved_at, received_at,
       departments ( name ),
       reporting_periods ( year, label ),
       submitter:profiles!quarter_signoffs_submitted_by_fkey ( full_name ),
       approver:profiles!quarter_signoffs_approved_by_fkey ( full_name ),
       receiver:profiles!quarter_signoffs_received_by_fkey ( full_name )`
    )
    .eq("id", id)
    .maybeSingle()
    .returns<DetailDbRow | null>();

  if (!data) return null;

  return {
    id: data.id,
    departmentId: data.department_id,
    departmentName: data.departments?.name ?? "—",
    periodId: data.reporting_period_id,
    periodYear: data.reporting_periods?.year ?? 0,
    periodLabel: data.reporting_periods?.label ?? "—",
    status: data.status,
    submittedBy: data.submitter?.full_name ?? null,
    submittedAt: data.submitted_at,
    submittedById: data.submitted_by,
    approvedBy: data.approver?.full_name ?? null,
    approvedAt: data.approved_at,
    approvedById: data.approved_by,
    receivedBy: data.receiver?.full_name ?? null,
    receivedAt: data.received_at,
  };
}

export type SignoffKpiRow = {
  id: string;
  name: string;
  target: string | null;
  actual: string;
  notMeasured: boolean;
  ratio: number | null;
  remark: string | null;
};

type KpiDbRow = {
  id: string;
  name: string;
  target_text: string | null;
  display_order: number | null;
  processes: { display_order: number | null } | null;
  kpi_measurements: {
    actual_value: number | null;
    actual_text: string | null;
    not_measured: boolean;
    remark: string | null;
    kpi_achievement_ratio: number | null;
  }[];
};

/**
 * The department is the page's subject here, not a permission filter. An IMS
 * admin reading IT's sign-off must see IT's rows and no one else's; RLS still
 * decides whether they may read any of it.
 *
 * Queried from kpis with the period filter on the embedded measurement, so a
 * KPI with nothing recorded still appears — as it must on a page whose whole
 * purpose is showing what was signed for.
 */
export async function getSignoffKpis(
  departmentId: string,
  periodId: string
): Promise<SignoffKpiRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("kpis")
    .select(
      `id, name, target_text, display_order,
       processes ( display_order ),
       kpi_measurements (
         actual_value, actual_text, not_measured, remark, kpi_achievement_ratio
       )`
    )
    .eq("department_id", departmentId)
    .eq("status", "active")
    .eq("kpi_measurements.reporting_period_id", periodId)
    .returns<KpiDbRow[]>();

  return (data ?? [])
    .sort(
      (a, b) =>
        (a.processes?.display_order ?? 2147483647) -
          (b.processes?.display_order ?? 2147483647) ||
        (a.display_order ?? 2147483647) - (b.display_order ?? 2147483647) ||
        a.name.localeCompare(b.name)
    )
    .map((k) => {
      const m = k.kpi_measurements[0];
      const actual = !m
        ? "—"
        : m.not_measured
          ? "Not measured"
          : m.actual_value !== null
            ? String(m.actual_value)
            : (m.actual_text?.trim() || "—");
      return {
        id: k.id,
        name: k.name,
        target: k.target_text,
        actual,
        notMeasured: m?.not_measured ?? false,
        ratio: m?.kpi_achievement_ratio ?? null,
        remark: m?.remark ?? null,
      };
    });
}

export type SignoffObjectiveRow = {
  id: string;
  title: string;
  achievement: number | null;
  activitiesCompleted: number | null;
  activitiesTotal: number | null;
  reasonForDeviation: string | null;
  notMeasured: boolean;
};

type ObjectiveDbRow = {
  id: string;
  title: string;
  reference_number: number | null;
  objective_measurements: {
    achievement: number | null;
    activities_completed: number | null;
    activities_total: number | null;
    reason_for_deviation: string | null;
    not_measured: boolean;
  }[];
};

export async function getSignoffObjectives(
  departmentId: string,
  periodId: string
): Promise<SignoffObjectiveRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("objectives")
    .select(
      `id, title, reference_number,
       objective_measurements (
         achievement, activities_completed, activities_total,
         reason_for_deviation, not_measured
       )`
    )
    .eq("department_id", departmentId)
    .eq("status", "active")
    .eq("objective_measurements.reporting_period_id", periodId)
    .order("reference_number")
    .returns<ObjectiveDbRow[]>();

  return (data ?? []).map((o) => {
    const m = o.objective_measurements[0];
    return {
      id: o.id,
      title: o.title,
      achievement: m?.achievement ?? null,
      activitiesCompleted: m?.activities_completed ?? null,
      activitiesTotal: m?.activities_total ?? null,
      reasonForDeviation: m?.reason_for_deviation ?? null,
      notMeasured: m?.not_measured ?? false,
    };
  });
}

export type SignoffRiskRow = {
  id: string;
  reference: number | null;
  title: string;
  severity: number | null;
  likelihood: number | null;
  rpn: number | null;
};

type RiskDbRow = {
  id: string;
  reference_number: number | null;
  risk_statement: string | null;
  threat: string | null;
  affected_assets: string | null;
  risk_assessments: {
    severity: number | null;
    likelihood: number | null;
    rpn: number | null;
  }[];
};

/**
 * Read-only context. Risks are not part of the completeness rule — a
 * reassessment follows its own cadence — but a reviewer signing the quarter
 * should still see where the register stands.
 */
export async function getSignoffRisks(
  departmentId: string,
  periodId: string
): Promise<SignoffRiskRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("risks")
    .select(
      `id, reference_number, risk_statement, threat, affected_assets,
       risk_assessments ( severity, likelihood, rpn )`
    )
    .eq("department_id", departmentId)
    // A baseline has a null period and is pre-treatment, so only the residual
    // for this quarter belongs on a sign-off.
    .eq("risk_assessments.reporting_period_id", periodId)
    .eq("risk_assessments.type", "residual")
    .order("reference_number")
    .returns<RiskDbRow[]>();

  return (data ?? []).map((r) => {
    const a = r.risk_assessments[0];
    return {
      id: r.id,
      reference: r.reference_number,
      // risk_statement, threat and affected_assets are all nullable on
      // purpose — SRD's historical form had no such columns.
      title: r.risk_statement ?? r.threat ?? r.affected_assets ?? "—",
      severity: a?.severity ?? null,
      likelihood: a?.likelihood ?? null,
      rpn: a?.rpn ?? null,
    };
  });
}

export type DecisionRow = {
  id: string;
  decision: Enums<"signoff_decision">;
  by: string;
  at: string;
  reason: string | null;
};

type DecisionDbRow = {
  id: string;
  decision: Enums<"signoff_decision">;
  created_at: string;
  reason: string | null;
  profiles: { full_name: string } | null;
};

export async function getSignoffDecisions(signoffId: string): Promise<DecisionRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("quarter_signoff_decisions")
    .select(`id, decision, created_at, reason, profiles ( full_name )`)
    .eq("signoff_id", signoffId)
    .order("created_at", { ascending: false })
    .returns<DecisionDbRow[]>();

  return (data ?? []).map((d) => ({
    id: d.id,
    decision: d.decision,
    by: d.profiles?.full_name ?? "—",
    at: d.created_at,
    reason: d.reason,
  }));
}

/**
 * The lock state for an entry screen: is this department's quarter closed to
 * edits, and where does the person go to see why. Mirrors what
 * guard_quarter_lock() enforces; the trigger remains the authority.
 */
export type QuarterLock = { locked: boolean; status: SignoffStatus; signoffId: string } | null;

export async function getQuarterLock(
  departmentId: string,
  year: number,
  label: string
): Promise<QuarterLock> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .eq("type", "quarterly")
    .maybeSingle();

  if (!period) return null;

  const { data } = await supabase
    .from("quarter_signoffs")
    .select("id, status")
    .eq("department_id", departmentId)
    .eq("reporting_period_id", period.id)
    .maybeSingle();

  if (!data) return null;
  const locked = ["submitted", "approved", "received"].includes(data.status);
  return locked ? { locked, status: data.status, signoffId: data.id } : null;
}

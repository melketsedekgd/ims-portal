import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { getQuarterlyPeriods } from "@/features/periods/queries";
import type { KpiFormData, KpiStatus } from "@/components/forms/KpiForm";

type KpiRow = {
  id: string;
  name: string;
  target_text: string | null;
  target_unit: string | null;
  display_order: number | null;
  processes: { name: string; display_order: number | null } | null;
  kpi_measurements: {
    actual_value: number | null;
    actual_text: string | null;
    not_measured: boolean;
    remark: string | null;
    evidence_reference: string | null;
    kpi_achievement_ratio: number | null;
  }[];
};

/**
 * A tracking-table row: the display shape plus the raw measurement fields the
 * entry dialog edits, so it can be pre-filled without a second fetch.
 */
export type KpiTrackingRow = KpiFormData & {
  unit: string | null;
  actualValue: number | null;
  notMeasured: boolean;
};

/**
 * The only fields that decide a KPI's status. Typed structurally so the
 * per-period list and the year series share one definition of "Achieved"
 * rather than each carrying its own copy of the rule.
 */
type AchievementFields = {
  not_measured: boolean;
  kpi_achievement_ratio: number | null;
};

function toStatus(m: AchievementFields | undefined): KpiStatus {
  // A recorded "not measured" is an answer; a missing row is the absence of
  // one. Checked first so it can never fall through to Pending or Deviated.
  if (m?.not_measured) return "Not Measured";
  if (!m || m.kpi_achievement_ratio === null) return "Pending";
  return m.kpi_achievement_ratio >= 1 ? "Achieved" : "Deviated";
}

const order = (n: number | null | undefined) => n ?? 9999;

export async function getKpisForPeriod(
  year: number,
  label: string
): Promise<KpiTrackingRow[]> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .single();

  if (!period) return [];

  const { data, error } = await supabase
    .from("kpis")
    .select(
      `id,
       name,
       target_text,
       target_unit,
       display_order,
       processes ( name, display_order ),
       kpi_measurements (
         actual_value,
         actual_text,
         not_measured,
         remark,
         evidence_reference,
         kpi_achievement_ratio
       )`
    )
    .eq("status", "active")
    .eq("kpi_measurements.reporting_period_id", period.id)
    .returns<KpiRow[]>();

  if (error) throw error;

  return (data ?? [])
    .sort(
      (a, b) =>
        order(a.processes?.display_order) - order(b.processes?.display_order) ||
        order(a.display_order) - order(b.display_order)
    )
    .map((k) => {
      const m = k.kpi_measurements[0];
      return {
        id: k.id,
        period: `${label} ${year}`,
        processName: k.processes?.name ?? "General",
        name: k.name,
        target: k.target_text ?? "",
        // actual_text is the human form from the reports ("8hr 27 mins").
        // Entries made through the form may carry only a number.
        // "N/A", not "-" or 0: not_measured is a value in its own right.
        actual: m?.not_measured
          ? "N/A"
          : m?.actual_text ??
            (m?.actual_value != null
              ? [m.actual_value, k.target_unit].filter(Boolean).join(" ")
              : ""),
        achievementPercentage: m?.not_measured
          ? "N/A"
          : m?.kpi_achievement_ratio != null
            ? `${Math.round(m.kpi_achievement_ratio * 100)}%`
            : "",
        status: toStatus(m),
        justification: m?.remark ?? "",
        evidence: m?.evidence_reference ?? "",
        unit: k.target_unit,
        actualValue: m?.actual_value ?? null,
        notMeasured: m?.not_measured ?? false,
      };
    });
}

export type QuarterKpiCounts = {
  label: string;
  achieved: number;
  deviated: number;
  pending: number;
  /** Recorded as not measured. Counted in total, never in the other three. */
  notMeasured: number;
  total: number;
};

type KpiSeriesRow = {
  id: string;
  kpi_measurements: (AchievementFields & { reporting_period_id: string })[];
};

/**
 * KPI status counts for every quarter of a year, in one round trip.
 *
 * The measurement embed is filtered with .in() over all four period ids rather
 * than .eq() over one, so a single query covers the whole series. Calling
 * getKpisForPeriod four times would cost four period lookups and four list
 * queries, and would still have to agree with this by convention; here the
 * same toStatus() decides both, so the chart and the table cannot disagree.
 */
export async function getKpiCountsByQuarter(
  year: number
): Promise<QuarterKpiCounts[]> {
  const periods = await getQuarterlyPeriods(year);
  if (periods.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .select(
      `id,
       kpi_measurements (
         reporting_period_id,
         not_measured,
         kpi_achievement_ratio
       )`
    )
    .eq("status", "active")
    .in(
      "kpi_measurements.reporting_period_id",
      periods.map((p) => p.id)
    )
    .returns<KpiSeriesRow[]>();

  if (error) throw error;

  const kpis = data ?? [];

  return periods.map((period) => {
    const counts: QuarterKpiCounts = {
      label: period.label,
      achieved: 0,
      deviated: 0,
      pending: 0,
      notMeasured: 0,
      total: kpis.length,
    };

    for (const k of kpis) {
      const m = k.kpi_measurements.find(
        (row) => row.reporting_period_id === period.id
      );
      switch (toStatus(m)) {
        case "Achieved":
          counts.achieved++;
          break;
        case "Deviated":
          counts.deviated++;
          break;
        case "Pending":
          counts.pending++;
          break;
        case "Not Measured":
          counts.notMeasured++;
          break;
      }
    }

    return counts;
  });
}

// ── Options for the create-KPI form ──────────────────────────────────────────

export type CreatableDepartment = { id: string; name: string; code: string };

/**
 * Departments this user may create KPIs in. Mirrors kpis_insert's with_check
 * (is_ims_admin() OR department_id IN my_managed_department_ids()) so the form
 * can offer only departments where the insert would succeed. Empty for a
 * responsible_user or ims_reviewer — the page renders a no-permission state
 * instead of a form that can only fail.
 */
export async function getCreatableDepartments(): Promise<CreatableDepartment[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const isAdmin = user.roles.some(
    (r) => r.key === "system_admin" || r.key === "ims_admin"
  );

  if (isAdmin) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code")
      .eq("status", "active")
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  // A manager role carries its department on the user_roles row; dedupe in
  // case the same department is granted twice.
  const seen = new Map<string, CreatableDepartment>();
  for (const r of user.roles) {
    if (r.key === "department_manager" && r.departmentId && !seen.has(r.departmentId)) {
      seen.set(r.departmentId, {
        id: r.departmentId,
        name: r.departmentName ?? r.departmentCode ?? "",
        code: r.departmentCode ?? "",
      });
    }
  }
  return [...seen.values()];
}

export type ProcessOption = { id: string; name: string; departmentId: string };

/**
 * Active processes for a set of departments, in display order.
 *
 * DELIBERATE DEPARTMENT FILTER. processes_select has qual `true`, so every
 * signed-in user reads all processes across departments, and kpis has no
 * trigger checking that a KPI and its process share a department. Without
 * this filter the form would offer SRD's process to an IT manager and the
 * insert would go through. This is the one place the "never filter by
 * department" rule does not apply — do not remove it.
 *
 * Fetched for every creatable department at once so switching the department
 * select is a client-side filter, not a refetch.
 */
export async function getProcessesForDepartments(
  departmentIds: string[]
): Promise<ProcessOption[]> {
  if (departmentIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processes")
    .select("id, name, department_id")
    .in("department_id", departmentIds)
    .eq("status", "active")
    .order("display_order");
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    departmentId: p.department_id,
  }));
}

export type UnitOption = { key: string; label: string; dimension: string };

/** Every unit, grouped by dimension. target_unit is a FK to units.key. */
export async function getUnits(): Promise<UnitOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("key, label, dimension")
    .order("dimension")
    .order("label");
  if (error) throw error;
  return data ?? [];
}
